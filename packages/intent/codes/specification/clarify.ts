import type { CodeRecovery, ReadonlyJsonValue } from "@intloom/workflow-sdk";
import type { SpecificationState } from "../../schemas/specification-state.ts";
import type { IntentCodeAccess } from "../../src/specification/interaction.ts";
import { isDeepStrictEqual } from "node:util";
import {
  answersSchema,
  interaction,
} from "../../src/specification/interaction.ts";
import { fail } from "../../src/specification/errors.ts";
import { hasUserResponse } from "../../src/specification/questions.ts";
import {
  readInitializedState,
  saveState,
} from "../../src/specification/state.ts";

async function clarify(_input: ReadonlyJsonValue, access: IntentCodeAccess) {
  const state = readInitializedState(access);
  const request = questions(state);
  const answers = await interaction(access).askQuestions(request);
  return applyAnswers(access, state, answers);
}

clarify.recover = async (saved: CodeRecovery, access: IntentCodeAccess) => {
  const state = readInitializedState(access);
  if (
    saved.action.kind !== "user_ask_questions" ||
    !isDeepStrictEqual(saved.action.request, questions(state))
  )
    fail(
      "Saved clarification does not match the current questions",
      "STALE_SPECIFICATION_REPLY",
    );
  return applyAnswers(access, state, saved.answer);
};

function questions(state: SpecificationState) {
  const pending = state.questions.filter((q) => !hasUserResponse(q));
  if (
    !pending.length ||
    new Set(pending.map((q) => q.id)).size !== pending.length
  )
    fail("Clarify requires unique unanswered questions");
  return pending.map((q) => ({
    id: q.id,
    question: q.question,
    ...(q.description === undefined ? {} : { description: q.description }),
    ...(q.options === undefined
      ? {}
      : {
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            ...(o.description === undefined
              ? {}
              : { description: o.description }),
          })),
        }),
    isSkippable: !q.isBlock,
  }));
}

async function applyAnswers(
  access: IntentCodeAccess,
  state: SpecificationState,
  input: unknown,
) {
  const pending = state.questions.filter((q) => !hasUserResponse(q));
  const answers = answersSchema.parse(input);
  if (!isDeepStrictEqual(readInitializedState(access), state))
    fail(
      "State changed while waiting for answers",
      "STALE_SPECIFICATION_REPLY",
    );
  if (
    answers.length !== pending.length ||
    new Set(answers.map((a) => a.questionId)).size !== answers.length
  )
    fail("Answers must match every requested question exactly once");
  for (const answer of answers) {
    const question = pending.find((q) => q.id === answer.questionId);
    if (!question) fail(`Unknown question: ${answer.questionId}`);
    if (answer.isSkipped) {
      if (question.isBlock) fail("Blocking questions cannot be skipped");
      question.skipped = true;
    } else question.answer = answer.answer;
  }
  delete state.confirmation;
  await saveState(access, state);
  return { outcome: "complete" };
}
export default clarify;
