import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
import { runtime, requirements, scope, analysis, runId } from "./runtime.ts";
import { check, confirm, commit } from "../stages/specification/src/steps.ts";
import { recordId, inputRecord } from "../src/storage.ts";
for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: confirmed stage publishes atomically, survives cleanup failure and storage reopen`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "intent-stage-storage-"));
    const open = () =>
      backend === "file"
        ? openFileStorage({ directory: join(root, "data") })
        : openSqliteStorage({
            filename: join(root, "storage.sqlite"),
            projectId: "stage-test",
          });
    let handle = await open();
    t.after(async () => {
      await handle.dispose();
      await rm(root, { recursive: true, force: true });
    });
    const f = runtime(
      "specification",
      { task: "draft", baseline: null, draft: requirements, scope, analysis },
      handle.access,
    );
    await check(f.access);
    f.replies.push({ isConfirmed: true });
    await confirm(f.access);
    f.flags.failClear = true;
    await assert.rejects(commit(f.access), /clear failed/);
    f.flags.failClear = false;
    await commit(f.access);
    assert.equal((await handle.access.listRecords({})).data.length, 1);
    assert.equal((await handle.access.listArtifacts({})).data.length, 1);
    const original = await inputRecord(handle.access, runId, "specification");
    await handle.dispose();
    handle = await open();
    assert.deepEqual(
      await inputRecord(handle.access, runId, "specification"),
      original,
    );
    const stored = await handle.access.getRecordById(
      recordId(runId, "specification"),
    );
    assert.ok(stored);
    assert.notEqual(stored.data, undefined);
  });
