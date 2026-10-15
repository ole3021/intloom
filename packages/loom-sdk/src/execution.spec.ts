import assert from "node:assert/strict";
import { test } from "node:test";
import { codeRecoverySchema, stepResultSchema } from "./execution.ts";

test("Step results contain a nonempty routing outcome only", () => {
  assert.deepEqual(stepResultSchema.parse({ outcome: "complete" }), {
    outcome: "complete",
  });
  for (const value of [
    {},
    { outcome: "" },
    { outcome: 1 },
    { outcome: "complete", data: {} },
  ])
    assert.equal(stepResultSchema.safeParse(value).success, false);
});

test("recovery associates each interaction kind with its request and answer", () => {
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
  assert.deepEqual(codeRecoverySchema.parse(confirmation), confirmation);
  assert.deepEqual(codeRecoverySchema.parse(questions), questions);
  for (const value of [
    { ...confirmation, answer: questions.answer },
    { ...questions, answer: confirmation.answer },
    { ...confirmation, request: questions.request },
    { ...questions, request: confirmation.request },
    { ...confirmation, actionId: "" },
    { ...confirmation, kind: "custom" },
    { ...confirmation, cursor: {} },
    { action: confirmation, answer: confirmation.answer },
  ])
    assert.equal(codeRecoverySchema.safeParse(value).success, false);
});
