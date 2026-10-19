import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createOperations } from "./project.ts";
import { createOperationReceipts } from "./receipts.ts";
import type { OperationsPorts } from "./ports.ts";
import { createRuntime } from "../runtime/create-runtime.ts";
import { unwrapMutation } from "../runtime/mutation.ts";
import { waitForRun } from "./wait-run.ts";
import { failure } from "../errors.ts";
import { deferred, runtimeFixture } from "../../test/runtime-fixture.ts";
import type { CheckpointSnapshot } from "../runtime/recovery/contracts.ts";

const policy = { source: "cli", agentExecutor: "service" } as const;

test("shutdown rejects every new operation without changing checkpoints, while known receipts remain queryable", async (t) => {
  const f = runtimeFixture();
  const entered = deferred();
  const release = deferred();
  f.codes.start = async () => {
    entered.resolve();
    await release.promise;
    return { outcome: "complete" };
  };
  const saved: CheckpointSnapshot[] = [];
  const runtime = createRuntime({
    ...f.options,
    recovery: {
      blueprints: { fixture: f.blueprint },
      loomIdentities: { fixture: "v1" },
      store: {
        read: () => saved.slice(-1),
        write: (snapshot) => {
          saved.push(structuredClone(snapshot) as CheckpointSnapshot);
        },
      },
    },
  });
  t.after(async () => {
    release.resolve();
    await runtime.suspend();
  });
  const instanceId = randomUUID();
  let closed = false;
  let starts = 0;
  const ports: OperationsPorts = {
    runtime,
    receipts: createOperationReceipts(instanceId),
    projectRoot: "/fixture",
    storage: f.storage,
    delegated: f.options.executor.delegated,
    assertOpen() {
      if (closed) throw failure("CLI_SERVICE_CLOSING", "Closing");
    },
    async startRun(_, input, __, operation) {
      starts++;
      return runtime.startRun(f.blueprint, input, policy, operation);
    },
    presentRun: (run) => run,
    async listLooms() {
      return [];
    },
    async status() {
      throw new Error("Unexpected status query");
    },
    async restoreMirror() {
      throw new Error("Unexpected mirror restore");
    },
  };
  const operations = createOperations(ports, "cli");
  for (const removed of ["run", "answerAsk", "cancelRun", "resumeRun"])
    assert.equal(removed in operations, false);
  const request = {
    serviceInstanceId: instanceId,
    operationId: randomUUID(),
    loomName: "fixture",
    input: { prompt: "pause" },
  };
  const admitted = await operations.admit("run", request);
  assert.equal(admitted.receipt.status, "accepted");
  if (admitted.receipt.status !== "accepted") return;
  const id = admitted.receipt.runId;
  await entered.promise;
  unwrapMutation(await runtime.pauseRun(id));
  release.resolve();
  assert.equal((await waitForRun(runtime, id)).status, "paused");
  await setImmediate();
  closed = true;
  await runtime.suspend();
  const before = structuredClone(saved);
  for (const kind of ["run", "answer", "pause", "stop", "resume"] as const) {
    const result = await operations.admit(
      kind,
      {
        ...request,
        operationId: randomUUID(),
        actionId: "old",
        answer: {},
        expectedRevision: 1,
      },
      id,
    );
    assert.equal(result.receipt.status, "rejected");
    if (result.receipt.status === "rejected")
      assert.equal(result.receipt.error.code, "CLI_SERVICE_CLOSING");
    assert.equal(
      operations.getOperation(instanceId, result.receipt.operationId).status,
      "found",
    );
  }
  assert.deepEqual(
    (await operations.admit("run", request)).receipt,
    admitted.receipt,
  );
  assert.equal(starts, 1);
  // Runtime also protects callers at its own boundary after suspension.
  const rejected = [
    await runtime.startRun(f.blueprint, { prompt: "late" }, policy),
    runtime.submitAnswer(id, "old", {}),
    await runtime.pauseRun(id),
    await runtime.cancelRun(id),
    await runtime.resumeRun(id, { operationId: randomUUID() }),
  ];
  for (const result of rejected) {
    assert.equal(result.status, "not_applied");
    assert.throws(() => unwrapMutation(result), { code: "KERNEL_UNAVAILABLE" });
  }
  assert.equal((await runtime.getRun(id)).status, "paused");
  assert.deepEqual(saved, before);
});
