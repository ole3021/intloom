import assert from "node:assert/strict";
import { test } from "node:test";
import { createRuntime } from "@intloom/kernel";
import { runtimeFixture } from "./runtime-fixture.ts";

test("built package entry executes a Blueprint and queries the same Run", async () => {
  const f = runtimeFixture();
  const runtime = createRuntime(f.options);
  const view = await runtime.flow(f.blueprint, "package consumer");
  assert.equal(view.status, "completed");
  assert.deepEqual(f.events, [
    "init:first",
    "code:start",
    "code:review",
    "init:second",
    "code:finish",
  ]);
  assert.deepEqual(await runtime.getRun(view.runId), view);
  assert.deepEqual(await runtime.listRuns("fixture"), [view]);
});

test("built package entry restores its original Code through the serialized action identity", async () => {
  const f = runtimeFixture();
  let returned = false;
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    returned = true;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const view = await runtime.flow(f.blueprint, "package consumer");
  assert.equal(returned, false);
  assert.equal(view.status, "waiting");
  assert.deepEqual(
    JSON.parse(JSON.stringify(view)),
    await runtime.getRun(view.runId),
  );
  assert.deepEqual(f.events, ["init:first"]);
  assert.ok(view.pendingAction);
  const completed = await runtime.answerAsk(view.runId, view.pendingAction.id, {
    isConfirmed: true,
  });
  assert.equal(returned, true);
  assert.equal(completed.status, "completed");
  assert.equal(completed.pendingAction, undefined);
  await assert.rejects(
    runtime.answerAsk(view.runId, view.pendingAction.id, { isConfirmed: true }),
    {
      code: "CONFLICT",
    },
  );
});

test("built package entry stops a waiting Run and rejects its old reply", async () => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const waiting = await runtime.flow(f.blueprint, "consumer");
  assert.ok(waiting.pendingAction);
  await runtime.cancelRun(waiting.runId);
  assert.equal(
    (await runtime.getRun(waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  await assert.rejects(
    runtime.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: true,
    }),
    {
      code: "CONFLICT",
    },
  );
});
