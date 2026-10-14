import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { openFileStorage } from "@intloom/kernel/storage/file";

test("prepared file baseline preserves complete commit identity and immutable history without copying runtime files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-intent-baseline-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const caseDirectory = join(root, "case");
  const baseline = join(caseDirectory, "baseline/intloom");
  const source = await openFileStorage({
    directory: baseline,
    layout: "directories",
  });
  const payload = {
    flowName: "intent",
    stageName: "specification",
    data: { title: "Initial scope" },
  };
  await source.access.commit([
    { type: "create_artifact", id: "ART-original", payload },
    { type: "append_record", id: "REC-original", payload },
  ]);
  await source.access.commit([
    {
      type: "replace_artifact",
      id: "ART-original",
      expectedRevision: 1,
      payload: { ...payload, data: { title: "Confirmed scope" } },
    },
  ]);
  assert.ok(source.exportSnapshot);
  const snapshot = await source.exportSnapshot();
  await source.dispose();
  await writeFile(join(baseline, "store.lock"), "Old lock must not be copied.");
  const project = join(root, "project");
  await mkdir(join(project, "intloom/artifacts"), { recursive: true });
  await mkdir(join(project, "intloom/records"));
  const context = join(root, "context.json");
  await writeFile(
    context,
    JSON.stringify({ project, caseDirectory, storage: "file" }),
  );
  const args = [
    fileURLToPath(new URL("./prepare.ts", import.meta.url)),
    context,
  ];
  const result = await promisify(execFile)(process.execPath, args);
  assert.equal(JSON.parse(result.stdout).historyPreserved, true);
  await assert.rejects(readFile(join(project, "intloom/store.lock")), {
    code: "ENOENT",
  });
  await assert.rejects(readFile(join(project, ".intloom/service.json")), {
    code: "ENOENT",
  });
  assert.deepEqual(
    await readFile(join(project, "intloom/store.json")),
    await readFile(join(baseline, "store.json")),
  );
  const copied = await openFileStorage({
    directory: join(project, "intloom"),
    layout: "directories",
  });
  try {
    assert.ok(copied.exportSnapshot);
    assert.deepEqual(await copied.exportSnapshot(), snapshot);
    assert.equal(
      (await copied.access.getArtifactById("ART-original"))?.revision,
      2,
    );
    assert.deepEqual(
      (await copied.access.getRecordById("REC-original"))?.data,
      { title: "Initial scope" },
    );
  } finally {
    await copied.dispose();
  }
  await assert.rejects(promisify(execFile)(process.execPath, args));
});
