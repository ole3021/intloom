import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createRuntime } from "./create-runtime.ts";
import { unwrapMutation } from "./mutation.ts";
import { runtimeFixture, deferred } from "../../test/runtime-fixture.ts";
import { waitForRun } from "../operations/wait-run.ts";
import { createExecution } from "../execution/create-execution.ts";
const policy = { source: "cli", agentExecutor: "service" } as const;

test("precondition rejection and checkpoint failure have different effect outcomes", async () => {
  const f = runtimeFixture();
  const runtime = createRuntime(f.options);
  const missing = await runtime.cancelRun("missing");
  assert.equal(missing.status, "not_applied");
  const failing = createRuntime({
    ...f.options,
    recovery: {
      blueprints: { fixture: f.blueprint },
      loomIdentities: { fixture: "v1" },
      store: {
        read: () => [],
        write: () => {
          throw new Error("disk failed");
        },
      },
    },
  });
  const result = await failing.startRun(
    f.blueprint,
    { prompt: "start" },
    policy,
  );
  assert.equal(result.status, "indeterminate");
  assert.deepEqual(f.events, []);
});
test("observer exceptions and observer cancellation never stop an admitted Run", async (t) => {
  const f = runtimeFixture();
  const gate = deferred();
  f.codes.start = async () => {
    await gate.promise;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.suspend());
  const run = unwrapMutation(
    await runtime.startRun(f.blueprint, { prompt: "start" }, policy),
  );
  let initial = true;
  runtime.watchRun(run.runId, () => {
    if (initial) {
      initial = false;
      return;
    }
    throw new Error("broken observer");
  });
  const controller = new AbortController();
  const wait = waitForRun(runtime, run.runId, controller.signal);
  controller.abort(new Error("observer closed"));
  await assert.rejects(wait, /observer closed/);
  assert.equal((await runtime.getRun(run.runId)).status, "running");
  gate.resolve();
  assert.equal((await waitForRun(runtime, run.runId)).status, "completed");
});
test("late commits remain facts without metrics and cannot replace the stopped outcome", async (t) => {
  const f = runtimeFixture();
  const entered = deferred();
  const gate = deferred();
  f.storage.commit = async () => {
    entered.resolve();
    await gate.promise;
    return {
      writtenArtifacts: [],
      appendedRecords: [
        {
          id: "actual",
          loomName: "fixture",
          stageName: "first",
          data: null,
          createdAt: new Date().toISOString(),
        },
      ],
      removedArtifactIds: [],
      removedRecordIds: [],
    };
  };
  f.codes.start = async (access) => {
    await access.storage.commit([]);
    return { outcome: "complete" };
  };
  const runtime = createRuntime({ ...f.options, executor: createExecution() });
  t.after(() => runtime.suspend());
  const run = unwrapMutation(
    await runtime.startRun(f.blueprint, { prompt: "start" }, policy),
  );
  await entered.promise;
  unwrapMutation(await runtime.cancelRun(run.runId));
  assert.equal((await runtime.getRun(run.runId)).settled, false);
  gate.resolve();
  await setImmediate();
  const final = await runtime.getRun(run.runId);
  assert.equal(final.lastError?.code, "RUN_STOPPED");
  assert.equal(final.settled, true);
  assert.equal(final.results?.[0]?.id, "actual");
  assert.equal(final.metrics, undefined);
});
test("accepted answer is checkpointed before delivery; originating operation finds terminal history", async (t) => {
  const f = runtimeFixture();
  const snapshots: unknown[] = [];
  const store = {
    read: () =>
      snapshots.length
        ? [
            structuredClone(
              snapshots.at(-1),
            ) as import("./recovery/contracts.ts").CheckpointSnapshot,
          ]
        : [],
    write: (v: unknown) => {
      snapshots.push(structuredClone(v));
    },
  };
  f.codes.start = async (access) => {
    await access.interaction.confirm("continue");
    return { outcome: "complete" };
  };
  const options = {
    ...f.options,
    recovery: {
      store,
      blueprints: { fixture: f.blueprint },
      loomIdentities: { fixture: "v1" },
    },
  };
  const runtime = createRuntime(options);
  t.after(() => runtime.suspend());
  const origin = { serviceInstanceId: randomUUID(), operationId: randomUUID() };
  const admitted = unwrapMutation(
    await runtime.startRun(f.blueprint, { prompt: "start" }, policy, origin),
  );
  const waiting = await waitForRun(runtime, admitted.runId);
  assert.ok(waiting.pendingAction);
  const answer = unwrapMutation(
    runtime.submitAnswer(
      waiting.runId,
      waiting.pendingAction.id,
      { isConfirmed: true },
      { ...origin, operationId: randomUUID() },
    ),
  );
  assert.equal(answer.status, "running");
  assert.equal(store.read()[0]?.phase, "answered");
  await waitForRun(runtime, admitted.runId);
  await setImmediate();
  await runtime.suspend();
  const reopened = createRuntime(options);
  await reopened.restore();
  t.after(() => reopened.suspend());
  const historical = await reopened.findRun(origin);
  assert.equal(historical?.runId, admitted.runId);
  assert.equal(historical?.historical, true);
  assert.equal(
    (await reopened.cancelRun(admitted.runId)).status,
    "not_applied",
  );
});

test("pause persists the request and completed outcome, then resumes without replaying Code", async (t) => {
  const f = runtimeFixture();
  const entered = deferred();
  const gate = deferred();
  let calls = 0;
  f.codes.start = async () => {
    calls++;
    entered.resolve();
    await gate.promise;
    return { outcome: "complete" };
  };
  const saved: import("./recovery/contracts.ts").CheckpointSnapshot[] = [];
  const options = {
    ...f.options,
    recovery: {
      loomIdentities: { fixture: "v1" },
      blueprints: { fixture: f.blueprint },
      store: {
        read: () => saved.slice(-1),
        write: (
          value: import("./recovery/contracts.ts").CheckpointSnapshot,
        ) => {
          saved.push(structuredClone(value));
        },
      },
    },
  };
  const runtime = createRuntime(options);
  t.after(() => runtime.suspend());
  const run = unwrapMutation(
    await runtime.startRun(f.blueprint, { prompt: "pause" }, policy),
  );
  await entered.promise;
  assert.equal(
    (await runtime.resumeRun(run.runId, { operationId: randomUUID() })).status,
    "not_applied",
  );
  const receipt = unwrapMutation(await runtime.pauseRun(run.runId));
  assert.equal(receipt.status, "running");
  assert.equal(receipt.pauseRequested, true);
  assert.equal(saved.at(-1)?.pauseRequested, true);
  gate.resolve();
  const paused = await waitForRun(runtime, run.runId);
  assert.equal(paused.status, "paused");
  assert.equal(saved.at(-1)?.phase, "step_result");
  await runtime.suspend();
  const reopened = createRuntime(options);
  t.after(() => reopened.suspend());
  await reopened.restore();
  assert.equal((await reopened.getRun(run.runId)).status, "paused");
  unwrapMutation(
    await reopened.resumeRun(run.runId, { operationId: randomUUID() }),
  );
  assert.equal((await waitForRun(reopened, run.runId)).status, "completed");
  assert.equal(calls, 1);
});

for (const failed of [false, true])
  test(`exclusive admission waits for a ${failed ? "failed" : "cancelled"} Run's late commit`, async (t) => {
    const f = runtimeFixture();
    const entered = deferred();
    const release = deferred();
    const effects: string[] = [];
    const commit = f.storage.commit;
    f.storage.commit = async (operations) => {
      entered.resolve();
      await release.promise;
      effects.push("old_commit");
      return commit(operations);
    };
    f.codes.start = async (access) => {
      if ((access.state.value as { intent: string }).intent === "old") {
        const pending = access.storage.commit([]);
        void pending.catch(() => {});
        if (failed) throw new Error("fail with pending effect");
        await pending;
      } else effects.push("new_run");
      return { outcome: "complete" };
    };
    const runtime = createRuntime({
      ...f.options,
      executor: createExecution(),
    });
    t.after(async () => {
      release.resolve();
      await runtime.suspend();
    });
    const blueprint = { ...f.blueprint, exclusive: true };
    const old = unwrapMutation(
      await runtime.startRun(blueprint, { prompt: "old" }, policy),
    );
    await entered.promise;
    if (failed) await waitForRun(runtime, old.runId);
    else unwrapMutation(await runtime.cancelRun(old.runId));
    assert.equal((await runtime.getRun(old.runId)).settled, false);
    const blocked = await runtime.startRun(
      blueprint,
      { prompt: "new" },
      policy,
    );
    assert.equal(blocked.status, "not_applied");
    assert.throws(() => unwrapMutation(blocked), { code: "BUSY" });
    assert.deepEqual(effects, []);
    release.resolve();
    await setImmediate();
    assert.equal((await runtime.getRun(old.runId)).settled, true);
    const next = unwrapMutation(
      await runtime.startRun(blueprint, { prompt: "new" }, policy),
    );
    await waitForRun(runtime, next.runId);
    assert.deepEqual(effects, ["old_commit", "new_run"]);
  });
