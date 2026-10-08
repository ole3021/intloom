import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import {
  deferred,
  fixtureStateSchema,
  runtimeFixture,
} from "../../test/runtime-fixture.ts";
import type { JsonValue } from "../shared/json.ts";
import type { CodeExecutionAccess } from "../effector/execution.ts";
import { createRuntime } from "./create-runtime.ts";

test("cancelRun rejects the original ask, invalidates access, and preserves its terminal snapshot", async () => {
  const f = runtimeFixture();
  let rejected: unknown;
  let access: CodeExecutionAccess<JsonValue> | undefined;
  f.codes.start = async (_input, current) => {
    access = current;
    try {
      await current.interaction.confirm("continue?");
    } catch (cause) {
      rejected = cause;
      throw cause;
    }
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const waiting = await runtime.flow(f.blueprint, "text");
  assert.ok(waiting.pendingAction);
  await runtime.cancelRun(waiting.runId);
  const stopped = await runtime.getRun(waiting.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  assert.equal(stopped.pendingAction, undefined);
  assert.deepEqual(stopped.cursor, waiting.cursor);
  await setImmediate();
  assert.ok(rejected instanceof Error && "code" in rejected);
  assert.equal(rejected.code, "RUN_STOPPED");
  assert.ok(access);
  assert.throws(() => access?.state.value, {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  await assert.rejects(access.state.clear(), {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  await assert.rejects(access.storage.commit([]), {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  assert.throws(() => access?.interaction.confirm("late"), {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  await assert.rejects(
    runtime.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: true,
    }),
    {
      code: "CONFLICT",
    },
  );
  await runtime.cancelRun(waiting.runId);
  assert.deepEqual(await runtime.getRun(waiting.runId), stopped);
});

test("public cancelRun releases flow during initialization without waiting for its external Promise", async () => {
  const f = runtimeFixture();
  const entered = deferred();
  const release = deferred<JsonValue>();
  Object.assign(f.first, {
    initializeState: () => {
      entered.resolve();
      return release.promise;
    },
  });
  const runtime = createRuntime(f.options);
  const started = runtime.flow(f.blueprint, "text");
  await entered.promise;
  const [running] = await runtime.listRuns();
  assert.ok(running);
  await runtime.cancelRun(running.runId);
  const stopped = await started;
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  release.resolve({ value: 9, intent: "text" });
  await setImmediate();
  assert.deepEqual(await runtime.getRun(running.runId), stopped);
  assert.deepEqual(f.events, []);
});

test("late running Code results, exceptions and writes cannot overwrite a stopped Run", async () => {
  for (const fail of [false, true]) {
    const f = runtimeFixture();
    const entered = deferred();
    const release = deferred();
    f.codes.start = async (_input, access) => {
      entered.resolve();
      await release.promise;
      await assert.rejects(access.state.update({ value: 9, intent: "text" }), {
        code: "EXECUTION_OWNERSHIP_LOST",
      });
      if (fail) throw new Error("late failure");
      return { outcome: "complete" };
    };
    const runtime = createRuntime(f.options);
    const started = runtime.flow(f.blueprint, "text");
    await entered.promise;
    const [running] = await runtime.listRuns();
    assert.ok(running);
    await runtime.cancelRun(running.runId);
    const stopped = await started;
    release.resolve();
    await setImmediate();
    assert.deepEqual(await runtime.getRun(running.runId), stopped);
    assert.equal(stopped.lastError?.code, "RUN_STOPPED");
    assert.deepEqual(f.events, ["init:first"]);
  }
});

test("cancelAllRuns cancels active Runs, retains completed Runs, and is safe when empty", async () => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    if (fixtureStateSchema.parse(access.state.value).intent !== "done")
      await access.interaction.confirm("continue?");
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  await runtime.cancelAllRuns();
  const a = await runtime.flow(f.blueprint, "A");
  const b = await runtime.flow(f.blueprint, "B");
  const done = await runtime.flow(f.blueprint, "done");
  await assert.rejects(runtime.cancelRun("missing"), { code: "NOT_FOUND" });
  assert.deepEqual(await runtime.getRun(a.runId), a);
  await runtime.cancelRun(a.runId);
  assert.deepEqual(await runtime.getRun(b.runId), b);
  await runtime.cancelAllRuns();
  assert.equal((await runtime.getRun(a.runId)).lastError?.code, "RUN_STOPPED");
  assert.equal((await runtime.getRun(b.runId)).lastError?.code, "RUN_STOPPED");
  assert.deepEqual(await runtime.getRun(done.runId), done);
  const all = await runtime.listRuns();
  await runtime.cancelAllRuns();
  assert.deepEqual(await runtime.listRuns(), all);
});

test("cancelRun wins against an accepted answer still advancing, and later answers conflict", async () => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    await access.state.clear();
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const waiting = await runtime.flow(f.blueprint, "text");
  assert.ok(waiting.pendingAction);
  const answering = runtime.answerAsk(waiting.runId, waiting.pendingAction.id, {
    isConfirmed: true,
  });
  await runtime.cancelRun(waiting.runId);
  const stopped = await answering;
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  await setImmediate();
  assert.deepEqual(await runtime.getRun(waiting.runId), stopped);
});

test("cancelRun prevents an already queued asynchronous State validation from committing", async () => {
  const f = runtimeFixture();
  const validating = deferred();
  const release = deferred();
  let access: CodeExecutionAccess<JsonValue> | undefined;
  let rejected: unknown;
  Object.assign(f.first, {
    stateSchema: fixtureStateSchema.superRefine(async (value) => {
      if (value.value === 9) {
        validating.resolve();
        await release.promise;
      }
    }),
  });
  f.codes.start = async (_input, current) => {
    access = current;
    try {
      await current.state.update({ value: 9, intent: "text" });
    } catch (cause) {
      rejected = cause;
      throw cause;
    }
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const started = runtime.flow(f.blueprint, "text");
  await validating.promise;
  const [running] = await runtime.listRuns();
  assert.ok(running);
  await runtime.cancelRun(running.runId);
  const stopped = await started;
  release.resolve();
  await setImmediate();
  assert.ok(rejected instanceof Error && "code" in rejected);
  assert.equal(rejected.code, "EXECUTION_OWNERSHIP_LOST");
  assert.deepEqual(await runtime.getRun(running.runId), stopped);
  assert.ok(access);
  assert.throws(() => access?.state.value, {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
});
