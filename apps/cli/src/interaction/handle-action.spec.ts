import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePendingAction } from "./handle-action.ts";
import { view, action } from "../../test/unit-fixture.ts";

test("submits to the original Run/action and returns the next authoritative view", async () => {
  const next = {
    ...view,
    pendingAction: { ...action, id: "ACTION-next" },
  };
  const answer = [
    { questionId: "required", isSkipped: false, answer: "raw\ntext" },
  ];
  const result = await handlePendingAction(
    view,
    {
      async present(action) {
        assert.equal(action.id, "ACTION-original");
        return { kind: "answered", answer };
      },
    },
    async (runId, actionId, received) => {
      assert.equal(runId, "RUN-original");
      assert.equal(actionId, "ACTION-original");
      assert.deepEqual(received, answer);
      return next;
    },
  );
  assert.equal(result.run, next);
  assert.equal(result.interaction, "answered");
});
for (const kind of ["dismissed", "unavailable"] as const)
  test(`${kind} preserves waiting and never submits an answer`, async () => {
    const result = await handlePendingAction(
      view,
      {
        async present() {
          return { kind };
        },
      },
      async () => {
        assert.fail("must not submit");
      },
    );
    assert.equal(result.run, view);
    assert.equal(result.interaction, kind);
  });
test("protocol input requests preserve the existing action and continuation", async () => {
  const continuation = { token: "protocol-only" };
  const result = await handlePendingAction(
    view,
    {
      async present() {
        return { kind: "input_required", continuation };
      },
    },
    async () => {
      assert.fail();
    },
  );
  assert.equal(result.run, view);
  assert.equal(result.continuation, continuation);
});
test("submission failure is not retried or converted into a new Run", async () => {
  const failure = new Error("stale action");
  let calls = 0;
  await assert.rejects(
    handlePendingAction(
      view,
      {
        async present() {
          return { kind: "answered", answer: [] };
        },
      },
      async () => {
        calls++;
        throw failure;
      },
    ),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
});
test("terminal Runs do not present an action", async () => {
  const { pendingAction: _action, ...base } = view;
  assert.equal(
    (
      await handlePendingAction(
        { ...base, status: "completed" },
        {
          async present() {
            assert.fail();
          },
        },
        async () => {
          assert.fail();
        },
      )
    ).interaction,
    "none",
  );
});

test("client Agent waiting never opens or submits a human form", async () => {
  const { pendingAction: _action, ...base } = view;
  const run = {
    ...base,
    execution: {
      source: "agent_ide" as const,
      agentExecutor: "mcp_client" as const,
    },
    pendingAgentCall: {
      id: "CALL-test",
      agentId: "AGENT-test",
      phase: "available" as const,
      createdAt: view.createdAt,
    },
  };
  const result = await handlePendingAction(
    run,
    {
      async present() {
        assert.fail("Agent task is not a human question");
      },
    },
    async () => {
      assert.fail("Agent result cannot use answerAsk");
    },
  );
  assert.equal(result.run, run);
  assert.equal(result.interaction, "unavailable");
});
