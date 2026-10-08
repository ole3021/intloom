import assert from "node:assert/strict";
import { test } from "node:test";
import { actionForm } from "./forms.ts";
import { action, confirmation } from "../../test/unit-fixture.ts";
import { resolveIde } from "../ide/resolve.ts";

test("flat native form maps options to exact labels and explicit skip", () => {
  assert.deepEqual(
    actionForm(action).decode({ q0_choice: "option_0", q1_skip: true }),
    [
      {
        questionId: "required",
        isSkipped: false,
        answer: "  local\ndeployment  ",
      },
      { questionId: "optional", isSkipped: true },
    ],
  );
});
test("custom multiline text is preserved", () => {
  assert.deepEqual(
    actionForm(action).decode({
      q0_choice: "custom",
      q0_answer: "  custom\noriginal text  ",
      q1_answer: "Other",
    }),
    [
      {
        questionId: "required",
        isSkipped: false,
        answer: "  custom\noriginal text  ",
      },
      { questionId: "optional", isSkipped: false, answer: "Other" },
    ],
  );
});
test("forms reject skipped blocking questions, missing text, whitespace and unknown fields", () => {
  for (const input of [
    { q0_choice: "skip", q1_skip: true },
    { q0_choice: "custom", q1_skip: true },
    { q0_choice: "custom", q0_answer: " \n", q1_skip: true },
    { q0_choice: "option_0", q1_skip: true, unexpected: true },
  ])
    assert.throws(() => actionForm(action).decode(input));
});
test("confirmation decline is a business false with original feedback", () => {
  const form = actionForm(confirmation);
  assert.deepEqual(
    form.decode({ decision: "revise", feedback: "  revision\nfeedback " }),
    { isConfirmed: false, feedback: "  revision\nfeedback " },
  );
  assert.deepEqual(form.decode({ decision: "confirm" }), { isConfirmed: true });
  assert.throws(() => form.decode({}));
});
test("only the registered Codex profile resolves; other clients remain extensible", () => {
  assert.equal(resolveIde("codex")?.id, "codex");
  assert.equal(resolveIde("future"), undefined);
  assert.equal(resolveIde("__proto__"), undefined);
});
