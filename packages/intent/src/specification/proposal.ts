import { isDeepStrictEqual } from "node:util";
import { getLogger } from "@intloom/utils";
import {
  specificationProposalSchema,
  type SpecificationQuestion,
} from "../../schemas/specification-state.ts";
import { fail } from "./errors.ts";
import {
  readInitializedState,
  saveState,
  type SpecificationAccess,
} from "./state.ts";

function questionContent(q: SpecificationQuestion) {
  return {
    id: q.id,
    question: q.question,
    description: q.description,
    options: q.options,
    isBlock: q.isBlock,
  };
}
export async function submitProposal(
  input: unknown,
  access: SpecificationAccess,
) {
  const proposal = specificationProposalSchema.parse(input);
  const state = readInitializedState(access);
  if ((state.proposalCount ?? 0) >= 12)
    fail("Specification proposal limit exceeded");
  state.proposalCount = (state.proposalCount ?? 0) + 1;
  const oldQuestions = new Map(state.questions.map((q) => [q.id, q]));
  const ids = new Set(proposal.questions.map((q) => q.id));
  if (
    ids.size !== proposal.questions.length ||
    state.questions.some((q) => !ids.has(q.id))
  )
    fail("Questions must retain unique IDs and existing history");
  if (
    proposal.processedFeedbackCount < state.processedFeedbackCount ||
    proposal.processedFeedbackCount > state.feedbacks.length
  )
    fail("Invalid processed feedback count");
  state.questions = proposal.questions.map((q) => {
    if (
      q.options &&
      (new Set(q.options.map((o) => o.id)).size !== q.options.length ||
        q.options.some((o) => !o.id.startsWith(`${q.id}:`)))
    )
      fail(`Invalid question option IDs: ${q.id}`);
    const old = oldQuestions.get(q.id);
    if (!old) return q;
    if (!isDeepStrictEqual(questionContent(old), questionContent(q)))
      fail(`Existing question content is immutable: ${q.id}`);
    return {
      ...q,
      ...(old.answer === undefined ? {} : { answer: old.answer }),
      ...(old.skipped === undefined ? {} : { skipped: old.skipped }),
    };
  });
  state.changes = proposal.changes;
  state.processedFeedbackCount = proposal.processedFeedbackCount;
  delete state.confirmation;
  await saveState(access, state);
  getLogger().debug("specification_proposal_saved", {
    questionCount: state.questions.length,
    processedFeedbackCount: state.processedFeedbackCount,
  });
  return { saved: true };
}
