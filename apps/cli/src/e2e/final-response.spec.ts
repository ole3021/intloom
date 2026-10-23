import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseFinalResponse,
  parseStructuredResponse,
  userDecisionSchema,
  userDecisionToolSchema,
} from "./final-response.ts";

test("object Tool transport retains strict final decision rules", () => {
  const incomplete = userDecisionToolSchema.parse({ status: "blocked" });
  assert.equal(userDecisionSchema.safeParse(incomplete).success, false);
  assert.equal(
    userDecisionSchema.safeParse({ status: "finished", reason: "Unexpected" })
      .success,
    false,
  );
  assert.equal(
    userDecisionSchema.safeParse({ status: "finished" }).success,
    true,
  );
  assert.equal(
    userDecisionSchema.safeParse({
      status: "blocked",
      category: "environment",
      reason: "Credential unavailable.",
    }).success,
    true,
  );
});

test("simulated-user decisions accept one unambiguous trailing JSON object; raw parsing stays strict", () => {
  const response =
    'The original Run completed; all results are committed.\n\n{"status":"finished"}';
  assert.deepEqual(parseFinalResponse(response, true), {
    value: { status: "finished" },
    format: "decision_with_preamble",
  });
  assert.throws(() => parseFinalResponse(response), {
    code: "MODEL_OUTPUT_INVALID",
  });
  assert.deepEqual(
    parseFinalResponse('```json\n{"outcome":"ready"}\n```').value,
    { outcome: "ready" },
  );
  assert.deepEqual(
    parseFinalResponse(
      'Environment unavailable.\n{"status":"blocked","category":"environment","reason":"Model unavailable."}',
      true,
    ).value,
    {
      status: "blocked",
      category: "environment",
      reason: "Model unavailable.",
    },
  );
});
test("MCP outcomes accept narration only with one complete final value matching the exact host schema", async () => {
  const schema = {
    type: "object",
    properties: { outcome: { type: "string", enum: ["ready"] } },
    required: ["outcome"],
    additionalProperties: false,
  };
  assert.deepEqual(
    await parseStructuredResponse(
      'The report was saved.\n{"outcome":"ready"}',
      schema,
    ),
    { value: { outcome: "ready" }, format: "schema_with_preamble" },
  );
  assert.deepEqual(
    await parseStructuredResponse(
      'The report was saved.\n```json\n{"outcome":"ready"}\n```',
      schema,
    ),
    { value: { outcome: "ready" }, format: "schema_with_preamble" },
  );
  for (const text of [
    'Saved.\n{"outcome":"invented"}',
    'Saved.\n{"outcome":"ready","passed":true}',
    'Saved.\n{"outcome":"ready"}\n{"outcome":"ready"}',
    'Saved.\n{"outcome":"ready"',
    'Saved.\n{"outcome":"ready"}\nMore text.',
    "The report was saved.",
  ])
    await assert.rejects(parseStructuredResponse(text, schema), {
      code: "MODEL_OUTPUT_INVALID",
    });
});
test("ambiguous, malformed, invented or incomplete final decisions remain failures", () => {
  for (const text of [
    '{"status":"blocked","category":"environment","reason":"Unavailable."}\n{"status":"finished"}',
    "Narrative only.",
    'Narrative.\n{"status":"finished"',
    'Narrative.\n{"status":"finished","passed":true}',
    'Narrative.\n{"status":"unknown"}',
    'Narrative.\n{"status":"finished"}\nMore narrative.',
    'Narrative.\n[{"status":"finished"}]',
  ])
    assert.throws(() => parseFinalResponse(text, true), {
      code: "MODEL_OUTPUT_INVALID",
    });
});
