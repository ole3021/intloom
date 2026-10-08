import assert from "node:assert/strict";
import { test } from "node:test";
import { view, terminal } from "../../test/unit-fixture.ts";
import { presentRun } from "./run-presentation.ts";
import { renderRun, renderStatus } from "./render.ts";

test("stopped presentation preserves the authoritative JSON and omits failure guidance", () => {
  const { pendingAction: _action, ...base } = view;
  const run = {
    ...base,
    status: "failed" as const,
    lastError: {
      code: "RUN_STOPPED",
      message: "The Run was stopped.",
      retryable: false,
    },
  };
  const before = structuredClone(run);
  assert.equal(presentRun(run).title, "Stopped");
  const text = renderRun(run);
  assert.match(text, /^Stopped · test/u);
  assert.match(text, /Committed data is retained/u);
  assert.doesNotMatch(text, /Execution failed|before running again|attach/u);
  const output = terminal([], false, true);
  output.ui.result({ run }, text);
  assert.deepEqual(JSON.parse(output.stdout).run, before);
  assert.deepEqual(run, before);
});

test("other Run outcomes retain their labels and actual failures retain diagnostics", () => {
  assert.equal(presentRun(view).title, "Waiting for an answer");
  const { pendingAction: _action, ...base } = view;
  assert.equal(presentRun({ ...base, status: "running" }).title, "Running");
  assert.equal(presentRun({ ...base, status: "completed" }).title, "Completed");
  const failed = renderRun({
    ...base,
    status: "failed",
    lastError: {
      code: "STEP_EXECUTION_FAILED",
      message: "Save failed",
      retryable: false,
    },
  });
  assert.match(failed, /^Execution failed/u);
  assert.match(failed, /STEP_EXECUTION_FAILED: Save failed/u);
  assert.match(failed, /Inspect the results/u);
});

test("service summary names the existing combined failure and stopped count", () => {
  const text = renderStatus({
    version: 1,
    projectRoot: "/project",
    pid: 1,
    instanceId: "test",
    url: "http://127.0.0.1:1/mcp",
    startedAt: view.createdAt,
    storage: "file",
    workflowCount: 1,
    availableWorkflowCount: 1,
    runningRuns: 0,
    waitingRuns: 0,
    completedRuns: 1,
    failedRuns: 2,
  });
  assert.match(text, /failed or stopped 2/u);
});
