import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { copyCase, filesUnder, selectCase } from "./cases.ts";
import { repositoryRoot } from "./options.ts";

test("shared cases normalize explicit IDs and preserve a complete immutable snapshot", async (t) => {
  const root = join(repositoryRoot, "packages/intent/e2e/cases");
  const selection = await selectCase(root, "s01", "seed");
  assert.equal(selection.data.manifest.id, "S01");
  assert.equal(selection.random, false);
  const target = await mkdtemp(join(tmpdir(), "e2e-case-copy-"));
  t.after(() => rm(target, { recursive: true, force: true }));
  await copyCase(selection.data, target);
  assert.equal(
    JSON.parse(JSON.stringify(selection.data.manifest.intents))[0],
    selection.data.intent,
  );
  await assert.rejects(copyCase(selection.data, target), { code: "EEXIST" });
  for (const id of ["S01", "M01", "L01"])
    assert.ok(
      (await selectCase(root, id, "seed")).data.knowledgeIds.length >= 4,
    );
});

test("random selection is repeatable; an invalid explicit case never falls back", async () => {
  const root = join(repositoryRoot, "packages/intent/e2e/cases");
  const first = await selectCase(root, undefined, "reproducible");
  const second = await selectCase(root, undefined, "reproducible");
  assert.equal(first.data.manifest.id, second.data.manifest.id);
  assert.equal(first.data.digest, second.data.digest);
  assert.deepEqual(first.candidates, ["L01", "M01", "S01"]);
  await assert.rejects(selectCase(root, "S99", "reproducible"), {
    code: "CASE_NOT_FOUND",
  });
});

test("case traversal rejects links to files outside the library", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-case-link-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(
    join(repositoryRoot, "package.json"),
    join(root, "outside.json"),
  );
  await assert.rejects(filesUnder(root), { code: "CASE_PATH_INVALID" });
});
