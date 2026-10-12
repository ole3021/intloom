import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createRuntime } from "../runtime/create-runtime.ts";
import { createRuntimeObservation } from "../runtime/run-observation.ts";
import { runtimeFixture } from "../../test/runtime-fixture.ts";
import type { RunCheckpoint } from "../runtime/recovery/store.ts";
import { jsonCopy } from "./contracts.ts";
import type { MirrorBoundary } from "./contracts.ts";

async function stable(runtime: ReturnType<typeof createRuntime>, id: string) {
  for (let tries = 0; tries < 1000; tries++) {
    const run = await runtime.getRun(id);
    if (run.status !== "running" && run.settled) return run;
    await delay(1);
  }
  throw new Error("Runtime did not settle");
}
function controlled() {
  const f = runtimeFixture();
  let saved: RunCheckpoint | undefined;
  const images: { boundary: MirrorBoundary; checkpoint: RunCheckpoint }[] = [];
  const observation = createRuntimeObservation({
    serviceInstanceId: randomUUID(),
    limits: { maxDurationMs: 1000 },
  });
  const recovery = {
    store: {
      read: () => (saved ? [saved] : []),
      write: (input: unknown) => {
        saved = jsonCopy(input) as RunCheckpoint;
      },
    },
    blueprints: { fixture: f.blueprint },
    workflowIdentities: { fixture: "test-identity" },
  };
  const mirror = {
    assertOpen() {},
    async capture(
      _entry: unknown,
      checkpoint: RunCheckpoint,
      pending: { boundary: MirrorBoundary },
    ) {
      images.push({
        boundary: jsonCopy(pending.boundary),
        checkpoint: jsonCopy(checkpoint),
      });
    },
  };
  return {
    f,
    images,
    recovery,
    mirror,
    observation,
    get saved() {
      return saved;
    },
  };
}
test("step_after capture failure pauses and retries saved outcome once; pause freezes budget and concurrent resume deduplicates", async (t) => {
  const c = controlled();
  let calls = 0;
  let fail = true;
  c.f.codes.start = () => {
    calls++;
    return { outcome: "complete" };
  };
  const capture = c.mirror.capture;
  c.mirror.capture = async (...args) => {
    if (args[2].boundary.kind === "step_after" && fail) {
      fail = false;
      throw new Error("disk full");
    }
    await capture(...args);
  };
  const runtime = createRuntime({
    ...c.f.options,
    recovery: c.recovery,
    mirror: c.mirror,
    observation: c.observation,
  });
  t.after(() => runtime.suspend());
  const paused = await runtime.flow(c.f.blueprint, "capture retry");
  assert.equal(paused.status, "paused");
  assert.equal(paused.control?.pauseReason, "mirror_capture_failed");
  assert.equal(c.saved?.phase, "step_result");
  assert.equal(calls, 1);
  const settled = await stable(runtime, paused.runId);
  const timing = settled.metrics?.timing;
  await delay(1100);
  assert.equal((await runtime.getRun(paused.runId)).status, "paused");
  assert.deepEqual(
    (await runtime.getRun(paused.runId)).metrics?.timing,
    timing,
  );
  const operation = { operationId: randomUUID() };
  const [a, b] = await Promise.all([
    runtime.resumeRun(paused.runId, operation),
    runtime.resumeRun(paused.runId, operation),
  ]);
  assert.deepEqual(a, b);
  assert.equal((await stable(runtime, paused.runId)).status, "completed");
  assert.equal(calls, 1);
  assert.equal(
    c.images.filter(
      (image) =>
        image.boundary.kind === "step_after" &&
        image.boundary.stepVisitId === 1,
    ).length,
    1,
  );
});
test("same-name Stage reentry allocates distinct visits and stage scope exits before reinitialization", async (t) => {
  const c = controlled();
  let calls = 0;
  c.f.codes.start = () => ({ outcome: ++calls === 1 ? "reenter" : "complete" });
  const runtime = createRuntime({
    ...c.f.options,
    recovery: c.recovery,
    mirror: c.mirror,
    observation: c.observation,
  });
  t.after(() => runtime.suspend());
  const done = await runtime.flow(c.f.blueprint, "same stage twice");
  await stable(runtime, done.runId);
  assert.deepEqual(
    c.images
      .filter((x) => x.boundary.kind === "stage_before_init")
      .map((x) => [x.boundary.stageName, x.boundary.stageVisitId]),
    [
      ["first", 1],
      ["first", 2],
      ["second", 3],
    ],
  );
  assert.deepEqual(
    c.images
      .filter((x) => x.boundary.kind === "step_before")
      .map((x) => x.boundary.stepVisitId),
    [1, 2, 3, 4],
  );
  // Restore the true first step_before with stage scope using the same Runtime recovery path.
  const first = c.images.find((x) => x.boundary.kind === "step_before");
  assert.ok(first);
  const saved = jsonCopy(first.checkpoint);
  assert.ok(saved.control);
  saved.run.status = "paused";
  saved.control.sourceMirrorId = randomUUID();
  saved.control.pauseReason = "restored";
  delete saved.control.capturePending;
  saved.control.scope = { kind: "stage", completed: false, stageVisitId: 1 };
  const f = runtimeFixture();
  f.codes.start = () => ({ outcome: "reenter" });
  const branch = createRuntime({
    ...f.options,
    recovery: {
      ...c.recovery,
      blueprints: { fixture: f.blueprint },
      store: { read: () => [saved], write() {} },
    },
    mirror: c.mirror,
    observation: createRuntimeObservation({ serviceInstanceId: randomUUID() }),
  });
  t.after(() => branch.suspend());
  await branch.restore();
  await branch.resumeRun(done.runId, { operationId: randomUUID() });
  assert.equal((await stable(branch, done.runId)).status, "paused");
  assert.deepEqual(f.events, []);
});
test("clear State restores an initialized empty binding and waiting does not emit step_after", async (t) => {
  const c = controlled();
  c.f.codes.start = async (_input, a) => {
    await a.state.clear();
    return { outcome: "complete" };
  };
  c.f.codes.review = async (_input, a) => {
    assert.equal(a.state.value, undefined);
    await a.state.create({ intent: "fresh" });
    return { outcome: "complete" };
  };
  const runtime = createRuntime({
    ...c.f.options,
    recovery: c.recovery,
    mirror: c.mirror,
    observation: c.observation,
  });
  t.after(() => runtime.suspend());
  const done = await runtime.flow(c.f.blueprint, "empty");
  await stable(runtime, done.runId);
  const empty = c.images.find(
    (x) =>
      x.boundary.kind === "step_before" && x.boundary.stepName === "review",
  );
  assert.ok(empty);
  assert.equal(empty.checkpoint.stage?.exists, false);
  const saved = jsonCopy(empty.checkpoint);
  assert.ok(saved.control);
  saved.run.status = "paused";
  saved.control.sourceMirrorId = randomUUID();
  delete saved.control.capturePending;
  saved.control.scope = { kind: "step", completed: false };
  const f = runtimeFixture();
  let initialized = 0;
  Object.assign(f.first, {
    initializeState() {
      initialized++;
      throw new Error("must not initialize");
    },
  });
  f.codes.review = c.f.codes.review as NonNullable<typeof c.f.codes.review>;
  const branch = createRuntime({
    ...f.options,
    recovery: {
      ...c.recovery,
      blueprints: { fixture: f.blueprint },
      store: { read: () => [saved], write() {} },
    },
    mirror: c.mirror,
    observation: createRuntimeObservation({ serviceInstanceId: randomUUID() }),
  });
  t.after(() => branch.suspend());
  await branch.restore();
  await branch.resumeRun(done.runId, { operationId: randomUUID() });
  assert.equal((await stable(branch, done.runId)).status, "paused");
  assert.equal(initialized, 0);
  const wait = controlled();
  wait.f.codes.start = async (_input, a) => {
    await a.interaction.confirm("wait");
    return { outcome: "complete" };
  };
  const waiting = createRuntime({
    ...wait.f.options,
    recovery: wait.recovery,
    mirror: wait.mirror,
  });
  t.after(() => waiting.suspend());
  const view = await waiting.flow(wait.f.blueprint, "waiting");
  assert.equal(view.status, "waiting");
  assert.equal(
    wait.images.some((x) => x.boundary.kind === "step_after"),
    false,
  );
});

test("capture time remains outside execution budget while the capture is still in progress", async (t) => {
  const c = controlled();
  const capture = c.mirror.capture;
  c.mirror.capture = async (...args) => {
    if (args[2].boundary.kind === "workflow_start") await delay(500);
    await capture(...args);
  };
  const observation = createRuntimeObservation({
    serviceInstanceId: randomUUID(),
    limits: { maxDurationMs: 400 },
  });
  const runtime = createRuntime({
    ...c.f.options,
    recovery: c.recovery,
    mirror: c.mirror,
    observation,
  });
  t.after(() => runtime.suspend());
  const done = await runtime.flow(c.f.blueprint, "slow capture");
  assert.equal(done.status, "completed");
  assert.equal(done.control?.scope.completed, true);
  await stable(runtime, done.runId);
  assert.ok(
    (await runtime.getRun(done.runId)).metrics &&
      ((await runtime.getRun(done.runId)).metrics?.timing.executionMs ??
        Infinity) < 400,
  );
});

test("explicit capture abandonment is recorded and requires workflow scope; a returned Step is never repeated", async (t) => {
  const c = controlled();
  let calls = 0;
  c.f.codes.start = () => {
    calls++;
    return { outcome: "complete" };
  };
  const capture = c.mirror.capture;
  c.mirror.capture = async (...args) => {
    if (args[2].boundary.kind === "step_after")
      throw new Error("persistent capture IO failure");
    await capture(...args);
  };
  const runtime = createRuntime({
    ...c.f.options,
    recovery: c.recovery,
    mirror: c.mirror,
    observation: c.observation,
  });
  t.after(() => runtime.suspend());
  const paused = await runtime.flow(c.f.blueprint, "explicit abandonment");
  await stable(runtime, paused.runId);
  assert.equal(paused.control?.pauseReason, "mirror_capture_failed");
  await assert.rejects(
    runtime.resumeRun(paused.runId, {
      operationId: randomUUID(),
      abandonMirror: true,
    }),
    /workflow scope/u,
  );
  await runtime.resumeRun(paused.runId, {
    operationId: randomUUID(),
    scope: "workflow",
    abandonMirror: true,
  });
  const done = await stable(runtime, paused.runId);
  assert.equal(done.status, "completed");
  assert.equal(done.control?.captureDisabled, true);
  assert.equal(c.saved?.control?.captureDisabled, true);
  assert.equal(calls, 1);
  assert.equal(
    c.images.some((x) => x.boundary.kind === "step_after"),
    false,
  );
});
