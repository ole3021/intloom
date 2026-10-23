import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLog } from "./logs.ts";

test("terminal summaries omit payloads and show stack locations only in debug", () => {
  const row = {
    time: "2026-10-08T06:30:15Z",
    level: 50,
    event: "step_failed",
    runId: "RUN-long",
    stageName: "specification",
    stepName: "analyze",
    err: { code: "TOOL_EXECUTION_FAILED", stack: ["tool.ts:3:2"] },
    payload: "UNNECESSARY",
  };
  const info = formatLog(row);
  assert.match(info, /specification\/analyze.*TOOL_EXECUTION_FAILED/u);
  assert.doesNotMatch(info, /RUN-long|UNNECESSARY|tool.ts/u);
  assert.match(formatLog(row, true), /tool.ts:3:2/u);
});

test("service summaries distinguish Runs and status while targeted views omit redundant Run IDs", () => {
  const base = {
    time: "2026-10-08T06:30:15Z",
    level: 50,
    event: "step_failed",
    runId: "RUN-a",
    err: { code: "LLM_REQUEST_FAILED", status: 401 },
  };
  assert.match(formatLog(base, false, true), /RUN-a.*HTTP 401/u);
  assert.match(
    formatLog(
      { ...base, runId: "RUN-b", err: { ...base.err, status: 429 } },
      false,
      true,
    ),
    /RUN-b.*HTTP 429/u,
  );
  assert.doesNotMatch(formatLog(base), /RUN-a/u);
  assert.match(
    formatLog({ ...base, event: "run_resumed", waitDurationMs: 1250 }),
    /waitMs=1250/u,
  );
  assert.match(
    formatLog({
      ...base,
      event: "model_step_completed",
      model: "example",
      inputTokens: 12,
      outputTokens: 4,
    }),
    /model=example.*in=12.*out=4/u,
  );
  assert.match(
    formatLog({
      ...base,
      event: "storage_committed",
      artifacts: [{ id: "ART-1", revision: 2 }],
      records: ["REC-1"],
    }),
    /artifact=ART-1@2.*record=REC-1/u,
  );
});
