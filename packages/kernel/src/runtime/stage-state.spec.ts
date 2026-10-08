import assert from "node:assert/strict";
import { test } from "node:test";
import * as z from "zod";
import type { BlueprintStage } from "../workflow/blueprint.ts";
import { createStageState } from "./stage-state.ts";
import type { RunState } from "./run-state.ts";

const schema = z.strictObject({
  id: z.string(),
  intent: z.string(),
  count: z.number().int().default(0),
  items: z.array(z.strictObject({ text: z.string() })).default([]),
});

function fixture(id = "RUN-1") {
  const run: RunState = {
    id,
    execution: { source: "cli", agentExecutor: "service" },
    flowName: "fixture",
    intent: "  original intent  ",
    cursor: { stageName: "first", stepName: "run" },
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const stage: BlueprintStage = {
    stageName: "first",
    stateSchema: schema,
    initializeState: ({ runId, intent }) => ({ id: runId, intent }),
    entryStepName: "run",
    steps: {},
    on: {},
  };
  return { run, stage, states: createStageState(run) };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("initializes from owned context and saves defaults with one Schema parse", async () => {
  const { run, stage, states } = fixture();
  let parses = 0;
  const access = await states.enter({
    ...stage,
    initializeState: (context) => {
      assert.deepEqual(context, {
        runId: run.id,
        flowName: run.flowName,
        stageName: "first",
        intent: run.intent,
      });
      assert.equal(Object.isFrozen(context), true);
      return { id: context.runId, intent: context.intent };
    },
    stateSchema: schema.transform((value) => {
      parses++;
      return { ...value, count: value.count + 1 };
    }),
  });
  assert.equal(parses, 1);
  assert.deepEqual(access.value, {
    id: run.id,
    intent: run.intent,
    count: 1,
    items: [],
  });
  assert.equal(states.access, access);
});

test("enforces create/update existence and idempotent clear without automatic initialization", async () => {
  const { stage, states } = fixture();
  const access = await states.enter(stage);
  const seed = { id: "RUN-1", intent: "replacement" };
  await assert.rejects(access.create(seed), { code: "STAGE_STATE_EXISTS" });
  await access.update({ ...seed, items: [{ text: "saved" }] });
  await access.update(seed);
  assert.deepEqual(access.value, { ...seed, count: 0, items: [] });
  await access.clear();
  await access.clear();
  assert.equal(access.value, undefined);
  await assert.rejects(access.update(seed), { code: "STAGE_STATE_NOT_FOUND" });
  await access.create(seed);
  assert.deepEqual(access.value, { ...seed, count: 0, items: [] });
});

test("rejects invalid inputs and non-JSON output without changing saved State", async () => {
  const { stage, states } = fixture();
  const access = await states.enter({
    ...stage,
    stateSchema: schema.transform((value) =>
      value.intent === "bad_output" ? { ...value, count: Number.NaN } : value,
    ),
  });
  const before = access.value;
  for (const input of [
    { id: "RUN-1", intent: "valid", count: "wrong" },
    { id: "RUN-1", intent: "bad_output" },
  ]) {
    await assert.rejects(access.update(input), { code: "STAGE_STATE_INVALID" });
    assert.deepEqual(access.value, before);
  }
  // @ts-expect-error Dates are not JSON business values.
  await assert.rejects(access.update({ date: new Date() }), {
    code: "STAGE_STATE_INVALID",
  });
  assert.deepEqual(access.value, before);
  await access.update({ id: "RUN-1", intent: "valid" });
});

test("detaches saved inputs and nested read snapshots", async () => {
  const { stage, states } = fixture();
  const access = await states.enter(stage);
  const input = { id: "RUN-1", intent: "valid", items: [{ text: "saved" }] };
  await access.update(input);
  assert.ok(input.items[0]);
  input.items[0].text = "caller changed input";
  const snapshot = access.value;
  assert.ok(snapshot && typeof snapshot === "object");
  const items = Reflect.get(snapshot, "items");
  Object.assign(items[0], { text: "caller changed snapshot" });
  assert.equal(schema.parse(access.value).items[0]?.text, "saved");
  const internalSnapshot = states.value;
  assert.ok(internalSnapshot && typeof internalSnapshot === "object");
  Object.assign(Reflect.get(internalSnapshot, "items")[0], {
    text: "caller changed diagnostic snapshot",
  });
  assert.equal(schema.parse(states.value).items[0]?.text, "saved");
});

test("keeps Step loops and waits, but resets same-name Stage reentry and revokes old access", async () => {
  const { run, stage, states } = fixture();
  const first = await states.enter(stage);
  await first.update({ id: run.id, intent: "edited", count: 4 });
  run.cursor.stepName = "again";
  assert.equal(schema.parse(first.value).count, 4);
  run.status = "waiting";
  assert.equal(schema.parse(first.value).count, 4);
  await assert.rejects(first.clear(), { code: "STAGE_STATE_INACTIVE" });
  run.status = "running";
  await first.update({ id: run.id, intent: "edited", count: 5 });
  const next = await states.enter(stage);
  assert.equal(schema.parse(next.value).count, 0);
  assert.throws(() => first.value, { code: "STAGE_STATE_INACTIVE" });
  await assert.rejects(first.update({ id: run.id, intent: "stale" }), {
    code: "STAGE_STATE_INACTIVE",
  });
  states.leave();
  assert.equal(states.value, undefined);
  assert.equal(states.access, undefined);
});

test("isolates Runs and replaces the current Stage rather than caching earlier State", async () => {
  const first = fixture("RUN-1");
  const second = fixture("RUN-2");
  const a = await first.states.enter(first.stage);
  const b = await second.states.enter(second.stage);
  await a.update({ id: first.run.id, intent: "edited" });
  assert.equal(schema.parse(b.value).id, second.run.id);
  assert.equal(schema.parse(b.value).intent, second.run.intent);
  first.run.cursor.stageName = "second";
  const next = await first.states.enter({
    ...first.stage,
    stageName: "second",
  });
  assert.equal(schema.parse(next.value).intent, first.run.intent);
  assert.throws(() => a.value, { code: "STAGE_STATE_INACTIVE" });
  first.run.cursor.stageName = "first";
  const reentered = await first.states.enter(first.stage);
  assert.equal(schema.parse(reentered.value).intent, first.run.intent);
});

test("retains failure data for Runtime inspection while denying terminal business access", async () => {
  const { run, stage, states } = fixture();
  const access = await states.enter(stage);
  const before = states.value;
  run.status = "failed";
  assert.deepEqual(states.value, before);
  assert.throws(() => access.value, { code: "STAGE_STATE_INACTIVE" });
  await assert.rejects(access.clear(), { code: "STAGE_STATE_INACTIVE" });
});

test("rejects obsolete asynchronous validation without writing into a new Stage", async () => {
  const { run, stage, states } = fixture();
  const started = deferred();
  const release = deferred();
  const access = await states.enter({
    ...stage,
    stateSchema: schema.superRefine(async (value) => {
      if (value.intent === "slow") {
        started.resolve();
        await release.promise;
      }
    }),
  });
  const input = { id: run.id, intent: "slow" };
  const pending = access.update(input);
  await started.promise;
  input.intent = "mutated";
  run.cursor.stageName = "second";
  const next = await states.enter({ ...stage, stageName: "second" });
  const rejected = assert.rejects(pending, { code: "STAGE_STATE_INACTIVE" });
  release.resolve();
  await rejected;
  assert.equal(schema.parse(next.value).intent, run.intent);
});

test("serializes competing creates and preserves later operations after a rejected write", async () => {
  const { stage, states } = fixture();
  const access = await states.enter(stage);
  await access.clear();
  const first = access.create({ id: "RUN-1", intent: "first" });
  const rejected = assert.rejects(
    access.create({ id: "RUN-1", intent: "second" }),
    { code: "STAGE_STATE_EXISTS" },
  );
  await Promise.all([first, rejected]);
  assert.equal(schema.parse(access.value).intent, "first");
  await access.update({ id: "RUN-1", intent: "updated" });
  assert.equal(schema.parse(access.value).intent, "updated");
});

test("failed and obsolete initializers never publish partial or replace newer State", async () => {
  const { run, stage, states } = fixture();
  await assert.rejects(
    states.enter({ ...stage, initializeState: () => ({ bad: "seed" }) }),
    { code: "RUN_INITIALIZATION_FAILED" },
  );
  assert.equal(states.value, undefined);
  assert.equal(states.access, undefined);
  const started = deferred();
  const release = deferred();
  const pending = states.enter({
    ...stage,
    initializeState: async () => {
      started.resolve();
      await release.promise;
      throw new Error("obsolete initializer failed");
    },
  });
  await started.promise;
  run.cursor.stageName = "second";
  const next = await states.enter({ ...stage, stageName: "second" });
  const rejected = assert.rejects(pending, { code: "STAGE_STATE_INACTIVE" });
  release.resolve();
  await rejected;
  assert.equal(states.access, next);
  assert.equal(schema.parse(next.value).id, run.id);
});

test("copies asynchronous write input before validation and atomically publishes the parsed result", async () => {
  const { run, stage, states } = fixture();
  const started = deferred();
  const release = deferred();
  const access = await states.enter({
    ...stage,
    stateSchema: schema.superRefine(async (value) => {
      if (value.intent === "slow") {
        started.resolve();
        await release.promise;
      }
    }),
  });
  const before = access.value;
  const input = { id: run.id, intent: "slow" };
  const pending = access.update(input);
  await started.promise;
  input.intent = "mutated";
  assert.deepEqual(access.value, before);
  release.resolve();
  await pending;
  assert.equal(schema.parse(access.value).intent, "slow");
});

test("treats a null JSON State as present rather than missing", async () => {
  const { stage, states } = fixture();
  const access = await states.enter({
    ...stage,
    stateSchema: z.null(),
    initializeState: () => null,
  });
  assert.equal(access.value, null);
  await assert.rejects(access.create(null), { code: "STAGE_STATE_EXISTS" });
  await access.update(null);
  await access.clear();
  assert.equal(access.value, undefined);
});
