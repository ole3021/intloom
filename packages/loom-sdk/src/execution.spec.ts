import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { codeRecoverySchema, stepResultSchema } from "./execution.ts";

describe("StepResult", () => {
  test("preserves the routing outcome", () => {
    assert.deepEqual(stepResultSchema.parse({ outcome: "complete" }), {
      outcome: "complete",
    });
  });

  for (const [name, value] of [
    ["null", null],
    ["bare outcome", "complete"],
    ["missing outcome", {}],
    ["empty outcome", { outcome: "" }],
    ["non-string outcome", { outcome: 1 }],
    ["business output", { outcome: "complete", output: { changes: [] } }],
    ["business data", { outcome: "complete", data: {} }],
    ["Run status", { status: "waiting", userAsk: {} }],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.equal(stepResultSchema.safeParse(value).success, false);
    });
  }
});

describe("CodeRecovery", () => {
  const confirmation = {
    actionId: "confirm-1",
    kind: "user_ask_confirmation",
    request: { context: "Publish?" },
    answer: { isConfirmed: false, feedback: "Revise" },
  };
  const questions = {
    actionId: "questions-1",
    kind: "user_ask_questions",
    request: [{ id: "q", question: "Which name?", isSkippable: false }],
    answer: [{ questionId: "q", isSkipped: false, answer: "Example" }],
  };
  for (const value of [confirmation, questions]) {
    test(`preserves ${value.kind} identity, request and answer`, () => {
      assert.deepEqual(codeRecoverySchema.parse(value), value);
    });
  }
  for (const [name, value] of [
    [
      "question answer for confirmation",
      { ...confirmation, answer: questions.answer },
    ],
    [
      "confirmation answer for questions",
      { ...questions, answer: confirmation.answer },
    ],
    [
      "question request for confirmation",
      { ...confirmation, request: questions.request },
    ],
    [
      "confirmation request for questions",
      { ...questions, request: confirmation.request },
    ],
    ["empty action identity", { ...confirmation, actionId: "" }],
    ["unknown interaction", { ...confirmation, kind: "custom" }],
    ["Runtime cursor in recovery data", { ...confirmation, cursor: {} }],
    [
      "obsolete action envelope",
      { action: confirmation, answer: confirmation.answer },
    ],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.equal(codeRecoverySchema.safeParse(value).success, false);
    });
  }
});
