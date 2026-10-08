import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, type TestContext } from "node:test";
import { exportArtifact } from "./export-artifact.ts";
import { artifact } from "../../test/artifact-fixture.ts";

async function directory(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "intloom-artifact-export-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test("export publishes complete JSON and requires explicit overwrite", async (t) => {
  const root = await directory(t);
  const filename = join(root, "\u9700\u6c42 with spaces.json");
  await exportArtifact(artifact, filename);
  assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), artifact);
  await writeFile(filename, "existing content");
  await assert.rejects(exportArtifact(artifact, filename), {
    code: "CLI_OUTPUT_EXISTS",
  });
  assert.equal(await readFile(filename, "utf8"), "existing content");
  await exportArtifact(artifact, filename, true);
  assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), artifact);
  assert.deepEqual(await readdir(root), ["\u9700\u6c42 with spaces.json"]);
});
test("concurrent default exports never overwrite the successful snapshot", async (t) => {
  const root = await directory(t);
  const filename = join(root, "artifact.json");
  const other = {
    ...artifact,
    revision: 2,
    data: { title: "different snapshot" },
  };
  const result = await Promise.allSettled([
    exportArtifact(artifact, filename),
    exportArtifact(other, filename),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  const winner = result[0]?.status === "fulfilled" ? artifact : other;
  assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), winner);
  assert.deepEqual(await readdir(root), ["artifact.json"]);
});
test("unwritable destinations reject without leaving temporary or partial output", async (t) => {
  const root = await directory(t);
  await assert.rejects(
    exportArtifact(artifact, join(root, "missing", "artifact.json")),
    { code: "CLI_ARTIFACT_EXPORT_FAILED" },
  );
  const target = join(root, "directory");
  await mkdir(target);
  await assert.rejects(exportArtifact(artifact, target, true), {
    code: "CLI_ARTIFACT_EXPORT_FAILED",
  });
  assert.deepEqual(await readdir(root), ["directory"]);
});
