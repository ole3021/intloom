import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFinalAgentOutput } from "./final-output.ts";

test("final outcome parsing accepts one complete final-round value without replay or inference", () => {
  for (const text of [
    '{"outcome":"ready"}',
    '```json\n{"outcome":"ready"}\n```',
    'The requested draft was saved.\n{"outcome":"ready"}',
    'The requested draft was saved.\n```json\n{"outcome":"ready"}\n```',
  ])
    assert.deepEqual(parseFinalAgentOutput(text), { outcome: "ready" });
});

test("empty, truncated, ambiguous or nonfinal JSON cannot authorize an outcome", () => {
  for (const text of [
    undefined,
    "",
    "The draft was saved.",
    'Saved. {"outcome":"ready"',
    '{"outcome":"old"}\n{"outcome":"ready"}',
    'Saved. {"outcome":"ready"}\nFurther narration.',
    'Saved. [{"outcome":"ready"}',
  ])
    assert.throws(() => parseFinalAgentOutput(text), {
      code: "AGENT_OUTPUT_INVALID",
    });
});
