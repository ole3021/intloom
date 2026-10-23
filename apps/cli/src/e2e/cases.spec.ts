import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";
import { caseSchema } from "./contracts.ts";
import { selectCase, roundKnowledge, roundInput, loadCase } from "./cases.ts";

test("case selection is reproducible and future knowledge stays outside the current user context", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "loom-cases-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "Alpha");
  await mkdir(directory);
  const manifest = {
    id: "Alpha",
    name: "Example",
    rounds: [
      { id: "one", input: { prompt: "first" } },
      { id: "two", input: { prompt: "second" }, knowledge: "later.md" },
    ],
  };
  await writeFile(join(directory, "case.yaml"), stringify(manifest));
  await writeFile(join(directory, "knowledge.md"), "## K01\nShared knowledge");
  await writeFile(join(directory, "later.md"), "## K02\nFuture secret");
  const first = await selectCase(root, undefined, "repeat");
  assert.equal(
    (await selectCase(root, undefined, "repeat")).data.digest,
    first.data.digest,
  );
  assert.equal(
    (await selectCase(root, "alpha", "ignored")).data.manifest.id,
    "Alpha",
  );
  assert.ok(!roundKnowledge(first.data, 0).content.includes("Future secret"));
  assert.ok(roundKnowledge(first.data, 1).content.includes("Future secret"));
  await assert.rejects(selectCase(root, "missing", "repeat"));
  await symlink("later.md", join(directory, "escape"));
  await assert.rejects(loadCase(directory), /symbolic/);
});

test("four input slots preserve text and resolve only ordinary paths inside the generated project", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "loom-inputs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/file.txt"), "input");
  const manifest = caseSchema.parse({
    id: "A",
    name: "Inputs",
    rounds: [
      {
        id: "one",
        input: {
          prompt: "  exact\ntext  ",
          files: ["assets/file.txt"],
          dirs: ["assets"],
          urls: ["https://example.invalid/"],
        },
      },
    ],
  });
  const actual = await roundInput(manifest, 0, root);
  assert.equal(actual.prompt, "  exact\ntext  ");
  assert.deepEqual(actual.files, [join(root, "assets/file.txt")]);
  assert.deepEqual(actual.dirs, [join(root, "assets")]);
  const round = manifest.rounds[0];
  assert.ok(round);
  round.input.files = ["../outside"];
  await assert.rejects(roundInput(manifest, 0, root));
  round.input.files = ["assets"];
  await assert.rejects(roundInput(manifest, 0, root), /Expected files/);
});
