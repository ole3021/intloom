import { waitForSettledRun } from "./run-observer.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import {
  createExecution,
  createOperationsPorts,
  initializeProject,
} from "@intloom/kernel/host";
import {
  createOperationReceipts,
  createOperations,
  waitForRun,
} from "@intloom/kernel/operations";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { compiledLoom } from "./initialization-fixture.ts";
import { projectFixture } from "./project-fixture.ts";
import { codeId } from "./loom-fixture.ts";

async function builtProject(t: TestContext, asks: boolean) {
  let execution: Awaited<ReturnType<typeof initializeProject>> | undefined;
  let storage: Awaited<ReturnType<typeof openFileStorage>> | undefined;
  // Close borrowed resources before the project fixture removes its directory.
  t.after(async () => {
    await execution?.runtime.suspend();
    await storage?.dispose();
  });
  const project = await projectFixture(t);
  await project.add(
    "built-runtime-fixture",
    compiledLoom("fixture", codeId).replace(
      /export const codes = .*;/u,
      `export const codes = { [${JSON.stringify(codeId)}]: async (access) => {
      const answer = ${asks ? 'await access.interaction.confirm("Continue?")' : "{ isConfirmed: true }"};
      await access.state.update({value: answer.isConfirmed ? 'accepted' : 'rejected'});
      await access.storage.commit([{type:'append_record',id:'completed',payload:{loomName:'fixture',stageName:'first',data:{answer}}}]);
      return {outcome:'complete'};
    } };`,
    ),
  );
  storage = await openFileStorage({ directory: join(project.root, "store") });
  execution = await initializeProject(project.root, {
    storage: storage.access,
    executor: createExecution(),
  });
  const serviceInstanceId = randomUUID();
  const operations = createOperations(
    createOperationsPorts(execution, {
      receipts: createOperationReceipts(serviceInstanceId),
      storage: storage.access,
      assertOpen() {},
      presentRun: (run) => run,
      async status() {
        throw new Error("Unexpected status query");
      },
    }),
    "cli",
  );
  const identity = () => ({ serviceInstanceId, operationId: randomUUID() });
  return { execution, storage, operations, identity };
}

test("built Host and Operations entries admit one Run, retain its receipt and persist its result", async (t) => {
  assert.equal(
    import.meta.resolve("@intloom/kernel/host"),
    new URL("../dist/host/index.js", import.meta.url).href,
  );
  assert.equal(
    import.meta.resolve("@intloom/kernel/operations"),
    new URL("../dist/operations/index.js", import.meta.url).href,
  );
  const f = await builtProject(t, false);
  const request = {
    ...f.identity(),
    loomName: "fixture",
    input: { prompt: "package consumer" },
  };
  const admission = await f.operations.admit("run", request);
  assert.equal(admission.receipt.status, "accepted");
  if (admission.receipt.status !== "accepted")
    assert.fail("Run was not admitted");
  const completed = await waitForSettledRun(
    f.execution.runtime,
    admission.receipt.runId,
  );
  assert.equal(completed.status, "completed");
  assert.deepEqual(await f.operations.getRun(completed.runId), completed);
  assert.deepEqual(await f.operations.listRuns("fixture"), [completed]);
  assert.deepEqual(
    (await f.operations.admit("run", request)).receipt,
    admission.receipt,
  );
  assert.deepEqual(
    f.operations.getOperation(request.serviceInstanceId, request.operationId),
    { status: "found", receipt: admission.receipt },
  );
  assert.deepEqual((await f.storage.access.getRecordById("completed"))?.data, {
    answer: { isConfirmed: true },
  });
  assert.equal((await f.storage.access.listRecords({})).data.length, 1);
});

test("built entries answer a serialized action on the same Run and reject a second answer", async (t) => {
  const f = await builtProject(t, true);
  const admission = await f.operations.admit("run", {
    ...f.identity(),
    loomName: "fixture",
    input: { prompt: "original text" },
  });
  assert.equal(admission.receipt.status, "accepted");
  if (admission.receipt.status !== "accepted")
    assert.fail("Run was not admitted");
  const waiting = await waitForRun(
    f.execution.runtime,
    admission.receipt.runId,
  );
  assert.equal(waiting.status, "waiting");
  assert.ok(waiting.pendingAction);
  assert.deepEqual(
    JSON.parse(JSON.stringify(waiting)),
    await f.operations.getRun(waiting.runId),
  );
  assert.equal(await f.storage.access.getRecordById("completed"), undefined);
  const answer = {
    isConfirmed: false,
    feedback: "  preserve original feedback  ",
  };
  const accepted = await f.operations.admit(
    "answer",
    { ...f.identity(), actionId: waiting.pendingAction.id, answer },
    waiting.runId,
  );
  assert.equal(accepted.receipt.status, "accepted");
  assert.equal(
    (await waitForSettledRun(f.execution.runtime, waiting.runId)).status,
    "completed",
  );
  assert.deepEqual((await f.storage.access.getRecordById("completed"))?.data, {
    answer,
  });
  const repeated = await f.operations.admit(
    "answer",
    { ...f.identity(), actionId: waiting.pendingAction.id, answer },
    waiting.runId,
  );
  assert.equal(repeated.receipt.status, "rejected");
  if (repeated.receipt.status === "rejected")
    assert.equal(repeated.receipt.error.code, "CONFLICT");
  assert.equal((await f.storage.access.listRecords({})).data.length, 1);
});

test("built entries stop a waiting Run without applying its continuation", async (t) => {
  const f = await builtProject(t, true);
  const admission = await f.operations.admit("run", {
    ...f.identity(),
    loomName: "fixture",
    input: { prompt: "cancel" },
  });
  assert.equal(admission.receipt.status, "accepted");
  if (admission.receipt.status !== "accepted")
    assert.fail("Run was not admitted");
  const waiting = await waitForRun(
    f.execution.runtime,
    admission.receipt.runId,
  );
  assert.ok(waiting.pendingAction);
  const stopped = await f.operations.admit("stop", f.identity(), waiting.runId);
  assert.equal(stopped.receipt.status, "accepted");
  assert.equal(
    (await f.operations.getRun(waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  const late = await f.operations.admit(
    "answer",
    {
      ...f.identity(),
      actionId: waiting.pendingAction.id,
      answer: { isConfirmed: true },
    },
    waiting.runId,
  );
  assert.equal(late.receipt.status, "rejected");
  if (late.receipt.status === "rejected")
    assert.equal(late.receipt.error.code, "CONFLICT");
  assert.deepEqual((await f.storage.access.listRecords({})).data, []);
});
