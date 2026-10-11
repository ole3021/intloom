import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { runtimeFixture, deferred } from "../../test/runtime-fixture.ts";
import { createRuntime } from "./create-runtime.ts";
import { createRuntimeObservation } from "./run-observation.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";

test("Kernel metrics retain actual commit references and exclude long human waits from execution budget", async (t) => {
  const f = runtimeFixture();
  const observation = createRuntimeObservation({
    serviceInstanceId: randomUUID(),
    limits: { maxDurationMs: 80 },
  });
  f.codes.start = async (_input, access) => {
    await access.storage.commit([]);
    await access.interaction.confirm("Confirm the fixed fixture?");
    return { outcome: "complete" };
  };
  f.storage.commit = async () => ({
    writtenArtifacts: [],
    appendedRecords: [
      {
        id: "actual-record",
        flowName: "fixture",
        stageName: "first",
        data: null,
        createdAt: new Date().toISOString(),
      },
    ],
    removedArtifactIds: [],
    removedRecordIds: [],
  });
  const runtime = createRuntime({ ...f.options, observation });
  t.after(() => runtime.suspend());
  const waiting = await runtime.flow(f.blueprint, "fixed fixture");
  assert.equal(waiting.status, "waiting");
  await delay(180);
  const stillWaiting = await runtime.getRun(waiting.runId);
  assert.equal(stillWaiting.status, "waiting");
  assert.equal(stillWaiting.results?.[0]?.id, "actual-record");
  assert.equal(stillWaiting.results?.[0]?.stepName, "start");
  assert.equal(stillWaiting.metrics?.scope, "service_instance");
  assert.ok(stillWaiting.pendingAction);
  const done = await runtime.answerAsk(
    waiting.runId,
    stillWaiting.pendingAction.id,
    { isConfirmed: true },
  );
  await delay(10);
  const final = await runtime.getRun(done.runId);
  assert.equal(final.status, "completed");
  assert.equal(final.settled, true);
  await runtime.cancelRun(final.runId);
  assert.deepEqual(await runtime.getRun(final.runId), final);
  assert.ok((final.metrics?.timing.humanWaitMs ?? 0) >= 170);
  assert.ok((final.metrics?.timing.executionMs ?? Infinity) < 80);
});

test("stable request identities deduplicate usage, retain unknown fields, and gate the next request", async (t) => {
  const f = runtimeFixture();
  const observation = createRuntimeObservation({
    serviceInstanceId: randomUUID(),
    limits: { maxModelCalls: 1 },
    prices: [
      {
        modelId: "fixture-model",
        inputPerMillion: 1,
        outputPerMillion: 2,
        pricingId: "fixture-price",
      },
    ],
  });
  f.codes.start = async () => {
    await observation.observer.beforeStep({ requestId: "one" });
    await observation.observer.beforeStep({ requestId: "one" });
    await observation.observer.afterStep({
      requestId: "one",
      modelId: "fixture-model",
      inputTokens: 5,
    });
    await observation.observer.afterStep({
      requestId: "one",
      modelId: "fixture-model",
      inputTokens: 999,
      outputTokens: 999,
    });
    await observation.observer.beforeStep({ requestId: "two" });
    assert.fail("a second request must be blocked");
  };
  const runtime = createRuntime({ ...f.options, observation });
  t.after(() => runtime.suspend());
  const run = await runtime.flow(f.blueprint, "budget");
  assert.equal(run.status, "failed");
  assert.equal(run.stopReason, "budget_exceeded");
  assert.equal(run.metrics?.calls.modelRequests, 1);
  assert.equal(run.metrics?.usage.inputTokens, 5);
  assert.equal(run.metrics?.usage.outputTokens, undefined);
  assert.equal(run.metrics?.usage.completeness, "partial");
  assert.equal(run.metrics?.cost.knownAmount, 0.000005);
  assert.equal(run.metrics?.cost.completeness, "partial");
});

test("a known late commit and usage update metadata after cancellation without resuming the Run", async (t) => {
  const f = runtimeFixture();
  const gate = deferred();
  const entered = deferred();
  const observation = createRuntimeObservation({
    serviceInstanceId: randomUUID(),
  });
  f.storage.commit = async () => {
    entered.resolve();
    await gate.promise;
    return {
      writtenArtifacts: [],
      appendedRecords: [
        {
          id: "late-record",
          flowName: "fixture",
          stageName: "first",
          data: null,
          createdAt: new Date().toISOString(),
        },
      ],
      removedArtifactIds: [],
      removedRecordIds: [],
    };
  };
  f.codes.start = async (_input, access) => {
    await observation.observer.beforeStep({ requestId: "known" });
    try {
      await access.storage.commit([]);
    } finally {
      await observation.observer.afterStep({
        requestId: "known",
        modelId: "fixture-model",
        inputTokens: 7,
        outputTokens: 2,
      });
    }
    throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED");
  };
  const runtime = createRuntime({ ...f.options, observation });
  t.after(() => runtime.suspend());
  const launched = await runtime.startFlow(f.blueprint, "late result");
  await entered.promise;
  await runtime.cancelRun(launched.runId);
  const stopped = await runtime.getRun(launched.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.settled, false);
  gate.resolve();
  await delay(20);
  const final = await runtime.getRun(launched.runId);
  assert.equal(final.status, "failed");
  assert.equal(final.lastError?.code, "RUN_STOPPED");
  assert.equal(final.settled, true);
  assert.equal(final.results?.[0]?.id, "late-record");
  assert.equal(final.metrics?.usage.inputTokens, 7);
  assert.equal(final.metrics?.usage.outputTokens, 2);
  assert.equal(final.updatedAt, stopped.updatedAt);
});
