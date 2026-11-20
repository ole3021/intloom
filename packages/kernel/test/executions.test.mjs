import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openKernelData } from "../dist/index.js";
import { fixture, kernelUrl, prepared } from "./fixtures/data.mjs";

test("execution records, filtered pagination and event positions survive process reopening", async (t) => {
  const { root, dataDir } = await fixture(t);
  const data = await openKernelData({ dataDir });
  t.after(() => data.close());
  const installation = await data.registerInstallation({
    directory: await prepared(root),
    packagePath: ".",
  });
  const first = await data.createExecution({
    package: installation.package,
    kind: "workflow",
    mode: "run",
    runId: randomUUID(),
    input: { prompt: "record fixture" },
  });
  const child = await data.createExecution({
    package: installation.package,
    kind: "code",
    parentId: first.executionId,
    input: [1, 2],
  });
  assert.equal(child.runId, first.runId);
  assert.equal(child.parentId, first.executionId);
  await data.completeExecution(child.executionId, {
    result: { status: "rejected", reason: "Evidence failed" },
  });
  await data.completeExecution(first.executionId, {
    result: { status: "succeeded" },
    value: null,
  });
  const later = await data.createExecution({
    package: installation.package,
    kind: "code",
    mode: "chat",
  });
  const page = await data.listExecutions({
    loomId: installation.package.name,
    limit: 1,
  });
  assert.deepEqual(
    page.entries.map((entry) => entry.executionId),
    [first.executionId],
  );
  assert.equal(
    (
      await data.listExecutions({
        loomId: installation.package.name,
        cursor: page.nextCursor,
      })
    ).entries.length,
    2,
  );
  assert.equal(
    (await data.listExecutions({ runId: first.runId })).entries.length,
    2,
  );
  assert.deepEqual(
    (await data.listExecutions({ status: "recorded" })).entries.map(
      (entry) => entry.executionId,
    ),
    [later.executionId],
  );
  assert.equal(
    (await data.listExecutions({ status: "rejected" })).entries[0].completion
      .result.reason,
    "Evidence failed",
  );
  await assert.rejects(
    data.listExecutions({ status: "recorded", cursor: page.nextCursor }),
    /query/,
  );
  const events = await data.listEvents(first.executionId, { limit: 1 });
  assert.equal(events.entries[0].type, "recorded");
  assert.ok(events.nextCursor);
  const completed = await data.listEvents(first.executionId, {
    cursor: events.nextCursor,
  });
  assert.equal(completed.entries[0].type, "completed");
  assert.equal(completed.entries[0].data.value, null);
  await assert.rejects(
    data.listEvents(child.executionId, { cursor: events.nextCursor }),
    /query/,
  );
  await assert.rejects(
    data.completeExecution(first.executionId, {
      result: { status: "failed", reason: "late change" },
    }),
    /already completed/,
  );
  await assert.rejects(
    data.completeExecution(later.executionId, { result: { status: "failed" } }),
  );
  await assert.rejects(
    data.createExecution({
      package: { ...installation.package, version: "9.0.0" },
      kind: "code",
      mode: "chat",
    }),
    /registered/,
  );
  await data.close();
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { openKernelData } from ${JSON.stringify(kernelUrl)};
       const data = await openKernelData({ dataDir: process.argv[1] });
       console.log(JSON.stringify({
         record: await data.getExecution(process.argv[2]),
         events: await data.listEvents(process.argv[2], { cursor: process.argv[3] })
       }));
       await data.close();`,
      dataDir,
      first.executionId,
      events.nextCursor,
    ],
    { encoding: "utf8" },
  );
  const persisted = JSON.parse(output);
  assert.equal(persisted.record.completion.result.status, "succeeded");
  assert.deepEqual(persisted.events, completed);
});

test("state and events roll back together when the event write fails", async (t) => {
  const { root, dataDir } = await fixture(t);
  const data = await openKernelData({ dataDir });
  t.after(() => data.close());
  const installation = await data.registerInstallation({
    directory: await prepared(root),
    packagePath: ".",
  });
  const execution = await data.createExecution({
    package: installation.package,
    kind: "code",
    mode: "chat",
  });
  const database = new DatabaseSync(join(dataDir, "system.sqlite"));
  t.after(() => database.close());
  database.exec(
    "CREATE TRIGGER fail_events BEFORE INSERT ON events BEGIN SELECT RAISE(FAIL, 'injected event failure'); END",
  );
  await assert.rejects(
    data.completeExecution(execution.executionId, {
      result: { status: "cancelled", reason: "stop" },
    }),
    /injected/,
  );
  assert.equal(
    (await data.getExecution(execution.executionId)).completion,
    undefined,
  );
  assert.equal(
    (await data.listExecutions({ status: "recorded" })).entries.length,
    1,
  );
  assert.equal(
    (await data.listEvents(execution.executionId)).entries.length,
    1,
  );
  await assert.rejects(
    data.createExecution({
      package: installation.package,
      kind: "code",
      mode: "chat",
    }),
    /injected/,
  );
  assert.equal((await data.listExecutions()).entries.length, 1);
  database.exec("DROP TRIGGER fail_events");
  await data.completeExecution(execution.executionId, {
    result: { status: "cancelled", reason: "stop" },
  });
  assert.equal(
    (await data.listEvents(execution.executionId)).entries.length,
    2,
  );
});
