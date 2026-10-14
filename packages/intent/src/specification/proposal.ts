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
  const issues: string[] = [];
  if (ids.size !== proposal.questions.length)
    issues.push("Question IDs must be unique within the proposal.");
  if (proposal.processedFeedbackCount !== state.feedbacks.length)
    issues.push("processedFeedbackCount must equal expectedFeedbackCount.");
  for (const q of proposal.questions) {
    if (
      q.options &&
      (new Set(q.options.map((o) => o.id)).size !== q.options.length ||
        q.options.some((o) => !o.id.startsWith(`${q.id}:`)))
    )
      issues.push(
        `Invalid question option IDs: ${q.id}. Use ${q.id}:<unique-key>.`,
      );
    const old = oldQuestions.get(q.id);
    if (old && !isDeepStrictEqual(questionContent(old), questionContent(q)))
      issues.push(
        `Existing question content is immutable: ${q.id}. Omit it; Code preserves its content and answer.`,
      );
  }
  if (issues.length) {
    await saveState(access, state);
    getLogger().debug("specification_proposal_rejected", {
      rule: "SPECIFICATION_PROPOSAL_INVALID",
      issueCount: issues.length,
    });
    return {
      saved: false as const,
      feedback: {
        rule: "SPECIFICATION_PROPOSAL_INVALID" as const,
        issues,
        existingQuestionIds: [...oldQuestions.keys()],
        expectedFeedbackCount: state.feedbacks.length,
      },
    };
  }
  // Existing questions and human responses belong to Code, not the next draft.
  state.questions.push(
    ...proposal.questions.filter((q) => !oldQuestions.has(q.id)),
  );
  state.changes = proposal.changes;
  state.processedFeedbackCount = proposal.processedFeedbackCount;
  delete state.confirmation;
  await saveState(access, state);
  getLogger().debug("specification_proposal_saved", {
    questionCount: state.questions.length,
    processedFeedbackCount: state.processedFeedbackCount,
  });
  return { saved: true as const };
}
