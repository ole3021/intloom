import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyFacts } from "./facts.ts";

test("completion alone cannot pass functional, formal-data and mirror checks", () => {
  const checks = verifyFacts({
    run: {
      runId: "RUN-example",
      flowName: "intent",
      status: "completed",
      settled: true,
      execution: { source: "cli", agentExecutor: "service" },
      cursor: { stageName: "validation", stepName: "finalize" },
      control: { traceId: "trace", captureDisabled: true },
    },
    intent: "original",
    source: "cli",
    executor: "service",
    storage: "file",
    artifacts: [],
    records: [],
    images: [],
    mirrorsValid: true,
    confirmations: [],
    originalIntents: [],
  });
  assert.equal(
    checks.find((check) => check.id === "run_completed")?.status,
    "passed",
  );
  for (const id of [
    "formal_results",
    "result_relationships",
    "stage_sequence",
    "confirmations",
    "original_intent",
    "mirror_integrity",
    "mirror_boundaries",
  ])
    assert.equal(checks.find((check) => check.id === id)?.status, "failed");
});
