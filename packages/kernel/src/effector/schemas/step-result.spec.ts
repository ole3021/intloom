import assert from "node:assert/strict";
import { test } from "node:test";
import { stepResultSchema } from "./step-result.ts";

test("accepts only outcome results and rejects business-data or run-status envelopes", () => {
  assert.deepEqual(stepResultSchema.parse({ outcome: "ready" }), {
    outcome: "ready",
  });
  for (const [label, value] of [
    ["null", null],
    ["bare outcome", "ready"],
    ["empty outcome", { outcome: "" }],
    ["non-string outcome", { outcome: 1 }],
    ["business output", { outcome: "ready", output: { changes: [] } }],
    ["business data", { outcome: "ready", data: {} }],
    ["Run status", { status: "waiting", userAsk: {} }],
  ] as const) {
    assert.equal(stepResultSchema.safeParse(value).success, false, label);
  }
});
