import assert from "node:assert/strict";
import { test } from "node:test";
import runtimeStateSchema, {
  specificationProposalSchema,
  specificationStateSchema,
} from "./specification-state.ts";

test("State schema parses the Runtime seed without inventing identity or intent", () => {
  const state = specificationStateSchema.parse({
    id: "RUN-real",
    intent: "original requirements",
  });
  assert.deepEqual(state.changes, []);
  assert.deepEqual(state.questions, []);
  assert.equal(state.baseline, undefined);
  assert.equal(
    specificationStateSchema.safeParse({ intent: "Requirements" }).success,
    false,
  );
  assert.equal(
    specificationStateSchema.safeParse({ id: "RUN-real" }).success,
    false,
  );
});
test("Agent proposal cannot write confirmation or feedback", () => {
  const proposal = { changes: [], questions: [], processedFeedbackCount: 0 };
  assert.equal(
    specificationProposalSchema.safeParse({
      ...proposal,
      confirmation: { confirmed: true },
    }).success,
    false,
  );
  assert.equal(
    specificationProposalSchema.safeParse({
      ...proposal,
      feedbacks: [{ source: "check", content: "fake" }],
    }).success,
    false,
  );
});

test("questions derive response state and reject resolution flags or injected replies", () => {
  const question = {
    id: "QST-1",
    question: "Is export required?",
    isBlock: true,
  };
  const seed = {
    id: "RUN-real",
    intent: "Requirements",
    questions: [question],
  };
  const proposal = {
    changes: [],
    questions: [question],
    processedFeedbackCount: 0,
  };
  assert.equal(specificationStateSchema.safeParse(seed).success, true);
  assert.equal(specificationProposalSchema.safeParse(proposal).success, true);
  for (const field of ["isSolved", "isHandled"]) {
    const flagged = { ...question, [field]: true };
    assert.equal(
      specificationStateSchema.safeParse({ ...seed, questions: [flagged] })
        .success,
      false,
    );
    assert.equal(
      specificationProposalSchema.safeParse({
        ...proposal,
        questions: [flagged],
      }).success,
      false,
    );
  }
  for (const response of [{ answer: "fake" }, { skipped: true }])
    assert.equal(
      specificationProposalSchema.safeParse({
        ...proposal,
        questions: [{ ...question, ...response }],
      }).success,
      false,
    );
});

test("Runtime State schema enforces the JSON boundary", () => {
  assert.equal(
    runtimeStateSchema.safeParse({
      id: "RUN-real",
      intent: "Requirements",
      confirmation: undefined,
    }).success,
    false,
  );
  assert.equal(
    runtimeStateSchema.safeParse({ id: "RUN-real", intent: "Requirements" })
      .success,
    true,
  );
});
