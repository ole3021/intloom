import { defineAgentTool } from "@intloom/workflow-sdk";
import { getLogger } from "@intloom/utils";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import { solutionEditSchema, draftRevisionSchema } from "../schemas/draft.ts";
import { reviewSolution } from "../src/solution/changes.ts";
import {
  authoring,
  draftRevision,
  objectChanges,
  editResultSchema,
} from "../src/flow/draft.ts";
import { solutionProposalSchema } from "../schemas/solution-state.ts";
import { readSolution, saveSolution } from "../src/solution/state.ts";
import { fail, json } from "../src/flow/shared.ts";
export const readSolutionContext = defineAgentTool({
  id: "read_solution",
  description:
    "Read the current design draft, confirmed requirements, actual answers and feedback.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => {
    const state = readSolution(access);
    return json({
      id: state.id,
      intent: state.intent,
      draftRevision: draftRevision(state),
      specification: authoring(state.specification?.data),
      draft: authoring(reviewSolution(state, true, true).artifact),
      questions: state.questions,
      feedbacks: state.feedbacks,
      checks: state.checks,
    });
  },
});
export const submitSolution = defineAgentTool({
  id: "submit_solution",
  description:
    "Finish design and submit a repeatable verification plan, or submit new questions before expanding the draft. Accepted edits and actual answers are preserved. Correct saved=false feedback before finishing.",
  inputSchema: solutionProposalSchema
    .omit({ changes: true, processedFeedbackCount: true })
    .extend({ draftRevision: draftRevisionSchema }),
  outputSchema: z.discriminatedUnion("saved", [
    z.strictObject({ saved: z.literal(true) }),
    z.strictObject({
      saved: z.literal(false),
      draftRevision: draftRevisionSchema.optional(),
      feedback: z.strictObject({
        rule: z.literal("SOLUTION_PROPOSAL_INVALID"),
        issues: z.array(z.string()),
        existingQuestionIds: z.array(z.string()),
        expectedFeedbackCount: z.number().int().nonnegative(),
      }),
    }),
  ]),
  endsAgent: (output) => output.saved,
  execute: async (input, access) => {
    const state = readSolution(access);
    const revision = draftRevision(state);
    if (input.draftRevision !== revision)
      return {
        saved: false as const,
        draftRevision: revision,
        feedback: {
          rule: "SOLUTION_PROPOSAL_INVALID" as const,
          issues: [
            "Draft revision mismatch. Use the current draftRevision returned here.",
          ],
          existingQuestionIds: state.questions.map((q) => q.id),
          expectedFeedbackCount: state.feedbacks.length,
        },
      };
    if (++state.iterations > 12)
      fail("Solution exceeded its proposal budget.", "INTENT_BUDGET_EXCEEDED");
    const ids = new Set(input.questions.map((q) => q.id));
    const oldQuestions = new Map(state.questions.map((q) => [q.id, q]));
    const issues: string[] = [];
    if (ids.size !== input.questions.length)
      issues.push("Question IDs must be unique within the proposal.");
    for (const q of input.questions) {
      const old = oldQuestions.get(q.id);
      if (
        !old &&
        q.options &&
        (new Set(q.options.map((option) => option.id)).size !==
          q.options.length ||
          q.options.some((option) => !option.id.startsWith(`${q.id}:`)))
      )
        issues.push(
          `Invalid question option IDs: ${q.id}. Use ${q.id}:<unique-key>.`,
        );
      if (!old) continue;
      const { answer: _answer, skipped: _skipped, ...content } = old;
      if (!isDeepStrictEqual(content, q))
        issues.push(
          `Existing question content is immutable: ${q.id}. Omit it; Code preserves its content and answer.`,
        );
    }
    const candidate: typeof state = {
      ...state,
      checks: input.checks,
      processedFeedbackCount: state.feedbacks.length,
      questions: [
        ...state.questions,
        ...input.questions.filter((q) => !oldQuestions.has(q.id)),
      ],
    };
    if (
      !candidate.questions.some(
        (q) => q.answer === undefined && q.skipped !== true,
      )
    ) {
      try {
        reviewSolution(candidate);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (issues.length) {
      await saveSolution(access, state);
      getLogger().debug("solution_proposal_rejected", {
        rule: "SOLUTION_PROPOSAL_INVALID",
        issueCount: issues.length,
      });
      return {
        saved: false as const,
        feedback: {
          rule: "SOLUTION_PROPOSAL_INVALID" as const,
          issues,
          existingQuestionIds: [...oldQuestions.keys()],
          expectedFeedbackCount: state.feedbacks.length,
        },
      };
    }
    state.questions.push(
      ...input.questions.filter((q) => !oldQuestions.has(q.id)),
    );
    state.checks = input.checks;
    state.processedFeedbackCount = state.feedbacks.length;
    delete state.confirmation;
    await saveSolution(access, state);
    return { saved: true as const };
  },
});

export const editSolution = defineAgentTool({
  id: "edit_solution",
  description:
    "Save only design objects changed in this call. Supply complete editable objects; include mutually dependent objects together. Earlier accepted edits are preserved. Use returned draftRevision for the next edit or submission.",
  inputSchema: solutionEditSchema,
  outputSchema: editResultSchema,
  execute: async (input, access) => {
    const state = readSolution(access);
    const revision = draftRevision(state);
    if (input.draftRevision !== revision)
      return {
        saved: false as const,
        issues: ["Draft changed; read_solution again."],
        draftRevision: revision,
      };
    let changes: typeof state.changes;
    try {
      const current = reviewSolution(state, true, true).artifact;
      changes = [...state.changes, ...objectChanges(current, input.edits)];
      reviewSolution({ ...state, changes }, true);
    } catch (error) {
      return {
        saved: false as const,
        issues: [error instanceof Error ? error.message : String(error)],
        draftRevision: revision,
      };
    }
    state.changes = changes;
    delete state.confirmation;
    await saveSolution(access, state);
    return { saved: true as const, draftRevision: draftRevision(state) };
  },
});
