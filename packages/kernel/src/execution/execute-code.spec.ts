import assert from "node:assert/strict";
import { test } from "node:test";
import { executionAccess } from "../../test/access-fixture.ts";
import { createExecution } from "./create-execution.ts";

test("standard Code execution awaits sync/async functions and passes exact access", async () => {
  const executor = createExecution();
  const f = executionAccess();
  for (const asyncResult of [false, true]) {
    const result = await executor.executeCode((access) => {
      assert.equal(access, f.code);
      return asyncResult
        ? Promise.resolve({ outcome: "complete" })
        : { outcome: "complete" };
    }, f.code);
    assert.deepEqual(result, { outcome: "complete" });
  }
});

test("Code errors are preserved without retries and invalid result envelopes are rejected", async () => {
  const f = executionAccess();
  const executor = createExecution();
  let calls = 0;
  const cause = new Error("Code failed");
  await assert.rejects(
    executor.executeCode(() => {
      calls++;
      throw cause;
    }, f.code),
    (error) => error === cause,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    executor.executeCode(
      // @ts-expect-error JavaScript implementations may violate the return type.
      () => null,
      f.code,
    ),
    { code: "STEP_RESULT_INVALID" },
  );
});

test("Code observes pre-call and in-flight cancellation before returning success", async () => {
  const f = executionAccess();
  const reason = new Error("cancelled");
  let called = false;
  f.controller.abort(reason);
  await assert.rejects(
    createExecution().executeCode(() => {
      called = true;
      return { outcome: "complete" };
    }, f.code),
    (error) => error === reason,
  );
  assert.equal(called, false);
  const running = executionAccess();
  await assert.rejects(
    createExecution().executeCode(async () => {
      running.controller.abort(reason);
      return { outcome: "complete" };
    }, running.code),
    (error) => error === reason,
  );
});

test("Agent iteration limits are validated independently of Loom routing", () => {
  for (const maxAgentSteps of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => createExecution({ maxAgentSteps }), {
      code: "INVALID_REQUEST",
    });
  assert.equal(
    typeof createExecution({ maxAgentSteps: 1 }).executeAgent,
    "function",
  );
});
