import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  userAnswerQuestionsSchema,
  userAskConfirmationSchema,
  userAskQuestionsSchema,
  userAnswerConfirmationSchema,
} from "./interaction.ts";

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

test("accepts explicit skip and retains the original nonempty answer", () => {
  assert.deepEqual(
    userAnswerQuestionsSchema.parse([{ questionId: "Q1", isSkipped: true }]),
    [{ questionId: "Q1", isSkipped: true }],
  );
  const text = "  original user answer  ";
  assert.deepEqual(
    userAnswerQuestionsSchema.parse([
      { questionId: "Q1", isSkipped: false, answer: text },
    ]),
    [{ questionId: "Q1", isSkipped: false, answer: text }],
  );
});

describe("question request shape", () => {
  for (const [name, questions] of [
    ["empty list", []],
    ["empty identity", [{ id: "", question: "Question", isSkippable: false }]],
    ["empty question", [{ id: "Q1", question: "", isSkippable: false }]],
    ["missing skip policy", [{ id: "Q1", question: "Question" }]],
    [
      "Runtime identity",
      [{ id: "Q1", question: "Question", isSkippable: false, runId: "RUN-1" }],
    ],
    [
      "empty option label",
      [
        {
          id: "Q1",
          question: "Question",
          isSkippable: false,
          options: [{ id: "O1", label: "" }],
        },
      ],
    ],
    [
      "unknown option field",
      [
        {
          id: "Q1",
          question: "Question",
          isSkippable: false,
          options: [{ id: "O1", label: "Keep", extra: true }],
        },
      ],
    ],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.equal(userAskQuestionsSchema.safeParse(questions).success, false);
    });
  }
});

describe("question answer shape", () => {
  for (const [name, answer] of [
    ["missing text", { questionId: "Q1", isSkipped: false }],
    ["empty text", { questionId: "Q1", isSkipped: false, answer: "" }],
    [
      "whitespace text",
      { questionId: "Q1", isSkipped: false, answer: " \t\n " },
    ],
    [
      "text on a skipped answer",
      { questionId: "Q1", isSkipped: true, answer: "Required" },
    ],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.equal(
        userAnswerQuestionsSchema.safeParse([answer]).success,
        false,
      );
    });
  }
});

test("question descriptions and option labels remain author-owned text", () => {
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
