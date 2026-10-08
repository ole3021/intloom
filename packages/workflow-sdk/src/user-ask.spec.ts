import assert from "node:assert/strict";
import { test } from "node:test";
import {
  userAnswerQuestionsSchema,
  userAskConfirmationSchema,
  userAskQuestionsSchema,
  userAnswerConfirmationSchema,
} from "./user-ask.ts";

test("accepts flat questions and single text answers without duplicating cursor ownership", () => {
  const questions = [
    { id: "Q1", question: "Is export required?", isSkippable: false },
  ];
  assert.deepEqual(userAskQuestionsSchema.parse(questions), questions);
  const answers = [{ questionId: "Q1", isSkipped: false, answer: "Required" }];
  assert.deepEqual(userAnswerQuestionsSchema.parse(answers), answers);
  assert.equal(
    userAnswerQuestionsSchema.safeParse([
      { questionId: "Q1", isSkipped: false, answer: ["Required"] },
    ]).success,
    false,
  );
  assert.equal(
    userAskConfirmationSchema.safeParse({
      fromCursor: 123,
      context: "Confirm requirements",
    }).success,
    false,
  );
});

test("requires explicit skip or nonempty text while retaining the original answer", () => {
  assert.deepEqual(
    userAnswerQuestionsSchema.parse([{ questionId: "Q1", isSkipped: true }]),
    [{ questionId: "Q1", isSkipped: true }],
  );
  for (const answer of [
    { questionId: "Q1", isSkipped: false },
    { questionId: "Q1", isSkipped: false, answer: "" },
    { questionId: "Q1", isSkipped: false, answer: " \t\n " },
    { questionId: "Q1", isSkipped: true, answer: "Required" },
  ]) {
    assert.equal(userAnswerQuestionsSchema.safeParse([answer]).success, false);
  }
  const text = "  original user answer  ";
  assert.deepEqual(
    userAnswerQuestionsSchema.parse([
      { questionId: "Q1", isSkipped: false, answer: text },
    ]),
    [{ questionId: "Q1", isSkipped: false, answer: text }],
  );
});

test("requires nonempty questions and strict question/option fields", () => {
  for (const questions of [
    [],
    [{ id: "", question: "Question", isSkippable: false }],
    [{ id: "Q1", question: "", isSkippable: false }],
    [{ id: "Q1", question: "Question" }],
    [{ id: "Q1", question: "Question", isSkippable: false, runId: "RUN-1" }],
    [
      {
        id: "Q1",
        question: "Question",
        isSkippable: false,
        options: [{ id: "O1", label: "" }],
      },
    ],
    [
      {
        id: "Q1",
        question: "Question",
        isSkippable: false,
        options: [{ id: "O1", label: "Keep", extra: true }],
      },
    ],
  ])
    assert.equal(userAskQuestionsSchema.safeParse(questions).success, false);
  const questions = [
    {
      id: "Q1",
      question: "Choose a direction.",
      description: " 用户原文 ",
      isSkippable: true,
      options: [{ id: "O1", label: "Keep", description: "Keep the original." }],
    },
  ];
  assert.deepEqual(userAskQuestionsSchema.parse(questions), questions);
});

test("confirmation Schemas preserve feedback without imposing business rules", () => {
  const feedback = "  用户反馈  ";
  assert.deepEqual(userAskConfirmationSchema.parse({ context: "Confirm?" }), {
    context: "Confirm?",
  });
  assert.deepEqual(userAnswerConfirmationSchema.parse({ isConfirmed: false }), {
    isConfirmed: false,
  });
  assert.deepEqual(
    userAnswerConfirmationSchema.parse({ isConfirmed: true, feedback }),
    {
      isConfirmed: true,
      feedback,
    },
  );
  assert.equal(
    userAskConfirmationSchema.safeParse({ context: "" }).success,
    false,
  );
  for (const answer of [
    {},
    { isConfirmed: "yes" },
    { isConfirmed: true, extra: true },
  ])
    assert.equal(userAnswerConfirmationSchema.safeParse(answer).success, false);
});
