import assert from "node:assert/strict";
import { test } from "node:test";
import { E2eError, runSchema } from "./contracts.ts";
import { preferRunFailure } from "./failure.ts";

const run = runSchema.parse({
  runId: "RUN-one",
  flowName: "intent",
  status: "failed",
  cursor: { stageName: "validation", stepName: "validate" },
  execution: { source: "cli", agentExecutor: "service" },
  lastError: {
    code: "LLM_REQUEST_FAILED",
    message: "HTTP 410. Model endpoint is unavailable.",
  },
});
test("an authoritative failed Run is not obscured by later simulated-user failures", () => {
  const prose = new E2eError(
    "MODEL_OUTPUT_INVALID",
    "The final text is not JSON.",
    "model",
  );
  const result = preferRunFailure(prose, run);
  assert.equal(result.primary.code, "LLM_REQUEST_FAILED");
  assert.match(result.primary.message, /HTTP 410/u);
  assert.equal(result.secondary, prose);
  assert.equal(
    preferRunFailure(prose, { ...run, status: "completed" }).primary,
    prose,
  );
  const transport = new E2eError(
    "MODEL_TRANSPORT_FAILED",
    "Later connection reset.",
    "environment",
  );
  assert.equal(
    preferRunFailure(transport, run).primary.code,
    "LLM_REQUEST_FAILED",
  );
  assert.equal(preferRunFailure(transport, run).secondary, transport);
  assert.equal(
    preferRunFailure(transport, {
      ...run,
      lastError: { code: "RUN_INTERRUPTED", message: "Interrupted." },
    }).primary,
    transport,
  );
});
test("interruption, execution budgets and explicit protocol failures retain their cause", () => {
  for (const code of [
    "EXECUTION_INTERRUPTED",
    "EXECUTION_BUDGET_EXCEEDED",
    "USER_ACTION_PROTOCOL_ERROR",
  ]) {
    const cause = new E2eError(code, "Original cause.", "runner");
    assert.equal(preferRunFailure(cause, run).primary, cause);
  }
});
