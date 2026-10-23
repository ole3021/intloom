import assert from "node:assert/strict";
import { test } from "node:test";
import {
  questionSubmissionSchema,
  confirmationSubmissionSchema,
  validateAnswer,
} from "./answers.ts";
import { runSchema } from "./contracts.ts";

const context = {
  runId: "RUN-one",
  actionId: "ASK-one",
  knowledgeRefs: ["K01"],
  decision: "Use the supplied knowledge.",
};
const answers = [
  {
    questionId: "required",
    isSkipped: false,
    answer: "  Local persistence.  ",
  },
  { questionId: "optional", isSkipped: true },
];
const run = runSchema.parse({
  runId: context.runId,
  loomName: "probe",
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
  status: "waiting",
  execution: { source: "cli", agentExecutor: "service" },
  cursor: { stageName: "specification", stepName: "clarify" },
  pendingAction: {
    id: context.actionId,
    loomName: "probe",
    cursor: { stageName: "check", stepName: "ask" },
    createdAt: "2026-10-18T00:00:00.000Z",
    kind: "user_ask_questions",
    request: [
      { id: "required", question: "Persistence?", isSkippable: false },
      { id: "optional", question: "Anything else?", isSkippable: true },
    ],
  },
});
test("public answer schemas reject encoded JSON and invented field names without changing answer text", () => {
  assert.deepEqual(
    questionSubmissionSchema.parse({ ...context, answers }).answers,
    answers,
  );
  for (const value of [
    JSON.stringify(answers),
    { answers },
    [{ questionId: "required", answer: "Local." }],
    [{ id: "required", isSkipped: false, answer: "Local." }],
    [{ questionId: "required", isSkipped: false, optionId: "local" }],
  ])
    assert.equal(
      questionSubmissionSchema.safeParse({ ...context, answers: value })
        .success,
      false,
    );
  assert.equal(
    confirmationSubmissionSchema.safeParse({ ...context, isConfirmed: "true" })
      .success,
    false,
  );
  assert.deepEqual(
    confirmationSubmissionSchema.parse({
      ...context,
      isConfirmed: false,
      feedback: "Scope conflicts with the knowledge.",
    }).feedback,
    "Scope conflicts with the knowledge.",
  );
});
test("answers must cover actual IDs exactly once, respect required questions and match action kind", () => {
  assert.deepEqual(validateAnswer(run, "user_ask_questions", answers), answers);
  for (const value of [
    answers.slice(0, 1),
    [answers[0], answers[0]],
    [{ questionId: "unknown", isSkipped: false, answer: "Local." }, answers[1]],
    [{ questionId: "required", isSkipped: true }, answers[1]],
  ])
    assert.throws(() => validateAnswer(run, "user_ask_questions", value));
  assert.throws(() =>
    validateAnswer(run, "user_ask_confirmation", { isConfirmed: true }),
  );
});
