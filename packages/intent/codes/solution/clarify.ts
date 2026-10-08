import type { ExecutableCode } from "@intloom/workflow-sdk";
import { isDeepStrictEqual } from "node:util";
import {
  readSolution,
  saveSolution,
  assertSolutionBasis,
} from "../../src/solution/state.ts";
import { fail } from "../../src/flow/shared.ts";
const clarify = (async (_input, access) => {
  const state = readSolution(access);
  const pending = state.questions.filter(
    (q) => q.answer === undefined && q.skipped !== true,
  );
  if (!pending.length) fail("No unanswered Solution questions.");
  const answers = await access.interaction.askQuestions(
    pending.map(({ isBlock, answer: _answer, skipped: _skipped, ...q }) => ({
      ...q,
      isSkippable: !isBlock,
    })),
  );
  await assertSolutionBasis(access, state);
  if (!isDeepStrictEqual(readSolution(access), state))
    fail("Solution changed while awaiting answers.");
  if (
    answers.length !== pending.length ||
    new Set(answers.map((a) => a.questionId)).size !== pending.length
  )
    fail("Every question requires one response.");
  for (const answer of answers) {
    const q = state.questions.find((q) => q.id === answer.questionId);
    if (!q) fail("Unknown question.");
    if (answer.isSkipped) {
      if (q.isBlock) fail("Blocking question cannot be skipped.");
      q.skipped = true;
    } else q.answer = answer.answer;
  }
  delete state.confirmation;
  await saveSolution(access, state);
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default clarify;
