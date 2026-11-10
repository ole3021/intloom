import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildPackage } from "../../packages/compiler/dist/index.js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));

test("meeting-notes source and website download accept exactly one text or file input", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "intloom-meeting-contract-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const built = await buildPackage(
    join(root, "examples/meeting-notes"),
    output,
  );
  const download = join(
    root,
    "apps/site/pages/public/downloads/0.4.0/meeting-notes-1.0.0.tgz",
  );
  async function command(archive: string) {
    const { stdout } = await exec("tar", [
      "-xOzf",
      archive,
      "package/commands/summarize/command.json",
    ]);
    return JSON.parse(stdout);
  }
  const contract = await command(built);
  assert.deepEqual(await command(download), contract);
  const schema = z.fromJSONSchema(contract.input);
  const file = { kind: "input-file", path: "notes.md" };
  for (const input of [{ prompt: "We agreed to pilot." }, { files: [file] }]) {
    assert.deepEqual(schema.parse(input), input);
  }
  for (const input of [
    {},
    { prompt: "" },
    { files: [] },
    { files: [file, file] },
    { prompt: "notes", files: [file] },
    { files: ["notes.md"] },
    { prompt: "notes", extra: true },
  ]) {
    assert.equal(schema.safeParse(input).success, false);
  }
});
