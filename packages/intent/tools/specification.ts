import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { readInitializedState, saveState } from "../src/specification/state.ts";
import { submitProposal } from "../src/specification/proposal.ts";
import {
  specificationEditSchema,
  draftRevisionSchema,
} from "../schemas/draft.ts";
import { applyChanges, emptyArtifact } from "../src/specification/changes.ts";
import { review } from "../src/specification/review.ts";
import {
  authoring,
  draftRevision,
  objectChanges,
  editResultSchema,
} from "../src/flow/draft.ts";
import { json } from "../src/flow/shared.ts";
import {
  specificationProposalSchema,
  specificationSubmissionResultSchema,
} from "../schemas/specification-state.ts";

export const readSpecification = defineAgentTool({
  id: "read_specification",
  description:
    "Read the current requirement draft, original Intent, actual answers and feedback.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => {
    const state = readInitializedState(access);
    return json({
      id: state.id,
      intent: state.intent,
      draftRevision: draftRevision(state),
      draft: authoring(
        applyChanges(
          state.baseline?.data ?? emptyArtifact(),
          state.changes,
          state.id,
        ).artifact,
      ),
      questions: state.questions,
      feedbacks: state.feedbacks,
      previousDraft: authoring(state.previousDraft),
    });
  },
});

export const submitSpecification = defineAgentTool({
  id: "submit_specification",
  description:
    "Finish requirement analysis, or submit new questions before expanding the draft. Tools preserve accepted edits and actual answers. Correct saved=false feedback before finishing.",
  inputSchema: specificationProposalSchema
    .omit({ changes: true, processedFeedbackCount: true })
    .extend({ draftRevision: draftRevisionSchema }),
  outputSchema: specificationSubmissionResultSchema,
  endsAgent: (output) => output.saved,
  execute: async (input, access) => {
    const state = readInitializedState(access);
    const revision = draftRevision(state);
    if (input.draftRevision !== revision)
      return {
        saved: false as const,
        draftRevision: revision,
        feedback: {
          rule: "SPECIFICATION_PROPOSAL_INVALID" as const,
          issues: [
            "Draft revision mismatch. Use the current draftRevision returned here.",
          ],
          existingQuestionIds: state.questions.map((q) => q.id),
          expectedFeedbackCount: state.feedbacks.length,
        },
      };
    const issues: string[] = [];
    const candidate: typeof state = {
      ...state,
      processedFeedbackCount: state.feedbacks.length,
      questions: [
        ...state.questions,
        ...input.questions.filter(
          (q) => !state.questions.some((old) => old.id === q.id),
        ),
      ],
    };
    if (
      !candidate.questions.some(
        (q) => q.answer === undefined && q.skipped !== true,
      )
    ) {
      try {
        review(candidate);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (issues.length)
      return {
        saved: false as const,
        feedback: {
          rule: "SPECIFICATION_PROPOSAL_INVALID" as const,
          issues,
          existingQuestionIds: state.questions.map((q) => q.id),
          expectedFeedbackCount: state.feedbacks.length,
        },
      };
    return submitProposal(
      {
        questions: input.questions,
        changes: state.changes,
        processedFeedbackCount: state.feedbacks.length,
      },
      access,
    );
  },
});

export const editSpecification = defineAgentTool({
  id: "edit_specification",
  description:
    "Save only the requirement objects changed in this call. Supply complete editable objects; include mutually dependent objects together. Existing draft edits are preserved. Omit unchanged objects. Use returned draftRevision for the next edit or submission.",
  inputSchema: specificationEditSchema,
  outputSchema: editResultSchema,
  execute: async (input, access) => {
    const state = readInitializedState(access);
    const revision = draftRevision(state);
    if (input.draftRevision !== revision)
      return {
        saved: false as const,
        issues: ["Draft changed; read_specification again."],
        draftRevision: revision,
      };
    let changes: typeof state.changes;
    try {
      const current = applyChanges(
        state.baseline?.data ?? emptyArtifact(),
        state.changes,
        state.id,
      ).artifact;
      changes = [
        ...state.changes,
        ...objectChanges(current, input.edits, input.removeAcceptances),
      ];
      applyChanges(state.baseline?.data ?? emptyArtifact(), changes, state.id);
    } catch (error) {
      return {
        saved: false as const,
        issues: [error instanceof Error ? error.message : String(error)],
        draftRevision: revision,
      };
    }
    state.changes = changes;
    delete state.confirmation;
    await saveState(access, state);
    return { saved: true as const, draftRevision: draftRevision(state) };
  },
});
