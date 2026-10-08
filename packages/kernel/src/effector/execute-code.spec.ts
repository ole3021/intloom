import assert from "node:assert/strict";
import { test } from "node:test";
import { executionAccess } from "../../test/effector-fixture.ts";
import { createEffector } from "./create-effector.ts";

test("standard Code execution awaits sync/async functions and passes exact input and access", async () => {
  const effector = createEffector();
  const f = executionAccess();
  const input = { original: "text" };
  for (const asyncResult of [false, true]) {
    const result = await effector.executeCode(
      (actualInput, access) => {
        assert.equal(actualInput, input);
        assert.equal(access, f.code);
        return asyncResult
          ? Promise.resolve({ outcome: "complete" })
          : { outcome: "complete" };
      },
      input,
      f.code,
    );
    assert.deepEqual(result, { outcome: "complete" });
  }
});

test("Code errors are preserved without retries and invalid result envelopes are rejected", async () => {
  const f = executionAccess();
  const effector = createEffector();
  let calls = 0;
  const cause = new Error("Code failed");
  await assert.rejects(
    effector.executeCode(
      () => {
        calls++;
        throw cause;
      },
      null,
      f.code,
    ),
    (error) => error === cause,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    effector.executeCode(
      // @ts-expect-error JavaScript implementations may violate the return type.
      () => null,
      null,
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
    createEffector().executeCode(
      () => {
        called = true;
        return { outcome: "complete" };
      },
      null,
      f.code,
    ),
    (error) => error === reason,
  );
  assert.equal(called, false);
  const running = executionAccess();
  await assert.rejects(
    createEffector().executeCode(
      async () => {
        running.controller.abort(reason);
        return { outcome: "complete" };
      },
      null,
      running.code,
    ),
    (error) => error === reason,
  );
});

test("Agent iteration limits are validated independently of Workflow routing", () => {
  for (const maxAgentSteps of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => createEffector({ maxAgentSteps }), {
      code: "INVALID_REQUEST",
    });
  assert.equal(
    typeof createEffector({ maxAgentSteps: 1 }).executeAgent,
    "function",
  );
});
