import assert from "node:assert/strict";
import { test } from "node:test";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { toRunView } from "./to-run-view.ts";
import type { RunState } from "./run-state.ts";

function runState(): RunState {
  return {
    id: "RUN-1",
    execution: { source: "cli", agentExecutor: "service" },
    flowName: "intent",
    intent: "  original user intent  ",
    cursor: { stageName: "specification", stepName: "clarify" },
    status: "running",
    createdAt: new Date("2026-10-05T00:00:00Z"),
    updatedAt: new Date("2026-10-05T00:01:00Z"),
  };
}

function waitingState(): RunState {
  const run = runState();
  run.status = "waiting";
  run.pendingAction = {
    id: "ASK-1",
    flowName: run.flowName,
    cursor: { ...run.cursor },
    kind: "user_ask_questions",
    request: [
      { id: "Q1", question: "Is export required?", isSkippable: false },
    ],
    createdAt: "2026-10-05T00:01:00Z",
  };
  return run;
}

test("projects Runtime errors and ISO times without exposing Error internals", () => {
  const run = runState();
  run.status = "failed";
  run.lastError = RUNTIME_ERRORS.wrap(
    "STEP_EXECUTION_FAILED",
    new Error("private cause"),
    { message: "Code failed", retryable: true },
  );
  const view = toRunView(run);
  assert.deepEqual(view.lastError, {
    code: "STEP_EXECUTION_FAILED",
    message: "Code failed",
    retryable: true,
  });
  assert.equal(view.createdAt, "2026-10-05T00:00:00.000Z");
  assert.equal(view.updatedAt, "2026-10-05T00:01:00.000Z");
  assert.equal(JSON.stringify(view).includes("private cause"), false);
  assert.equal(view.lastError instanceof Error, false);
  assert.equal(Object.hasOwn(view, "pendingAction"), false);
  assert.equal(Object.hasOwn(view, "intent"), false);
});

test("returns detached cursors and nested request JSON without changing RunState", () => {
  const run = waitingState();
  const before = structuredClone(run);
  const view = toRunView(run);
  assert.ok(view.pendingAction);
  assert.notEqual(view.cursor, run.cursor);
  assert.notEqual(view.pendingAction, run.pendingAction);
  Object.assign(view.cursor, { stepName: "caller_change" });
  Object.assign(view.pendingAction.cursor, { stageName: "caller_change" });
  const questions = view.pendingAction.request;
  assert.ok(Array.isArray(questions));
  Object.assign(questions[0], { question: "caller_change" });
  assert.deepEqual(run, before);
  assert.deepEqual(toRunView(run).cursor, run.cursor);
});

test("preserves the final cursor and exposes stopped Runs as failed", () => {
  const run = runState();
  run.status = "completed";
  assert.deepEqual(toRunView(run).cursor, run.cursor);
  assert.equal(Object.hasOwn(toRunView(run), "lastError"), false);
  run.status = "failed";
  run.lastError = RUNTIME_ERRORS.create("RUN_STOPPED");
  const view = toRunView(run);
  assert.equal(view.status, "failed");
  assert.equal(view.lastError?.code, "RUN_STOPPED");
  assert.deepEqual(view.cursor, run.cursor);
});

test("rejects inconsistent waiting status and action ownership", () => {
  assert.throws(() => toRunView({ ...runState(), status: "waiting" }), {
    code: "RUN_STATE_INVALID",
  });
  const run = waitingState();
  assert.throws(() => toRunView({ ...run, status: "running" }), {
    code: "RUN_STATE_INVALID",
  });
  assert.ok(run.pendingAction);
  for (const action of [
    { ...run.pendingAction, flowName: "other" },
    { ...run.pendingAction, cursor: { ...run.cursor, stepName: "other" } },
    { ...run.pendingAction, cursor: { ...run.cursor, stageName: "other" } },
  ]) {
    assert.throws(() => toRunView({ ...run, pendingAction: action }), {
      code: "RUN_STATE_INVALID",
    });
  }
});

test("rejects inconsistent errors and invalid projection dates", () => {
  assert.throws(() => toRunView({ ...runState(), status: "failed" }), {
    code: "RUN_STATE_INVALID",
  });
  assert.throws(
    () =>
      toRunView({
        ...runState(),
        lastError: RUNTIME_ERRORS.create("RUN_STOPPED"),
      }),
    { code: "RUN_STATE_INVALID" },
  );
  assert.throws(
    () => toRunView({ ...runState(), updatedAt: new Date("invalid") }),
    { code: "RUN_STATE_INVALID" },
  );
});
