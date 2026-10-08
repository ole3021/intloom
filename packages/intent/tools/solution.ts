import { defineAgentTool } from "@intloom/workflow-sdk";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import { solutionArtifactSchema } from "../schemas/solution-artifact.ts";
import { solutionProposalSchema } from "../schemas/solution-state.ts";
import { readSolution, saveSolution } from "../src/solution/state.ts";
import { fail, json } from "../src/flow/shared.ts";
export const readSolutionContext = defineAgentTool({
  id: "read_solution",
  description:
    "Read this Run's confirmed Specification, current Solution baseline, cumulative draft, actual answers and feedback. checks lists real commands that will be run before implementation completion.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) =>
    json({
      ...readSolution(access),
      artifactSchema: z.toJSONSchema(solutionArtifactSchema),
    }),
});
export const submitSolution = defineAgentTool({
  id: "submit_solution",
  description:
    "Save cumulative Solution changes, immutable questions and a concrete build/test check plan for user confirmation. No formal commit occurs here.",
  inputSchema: solutionProposalSchema,
  outputSchema: z.strictObject({ saved: z.boolean() }),
  execute: async (input, access) => {
    const state = readSolution(access);
    if (++state.iterations > 12)
      fail("Solution exceeded its proposal budget.", "INTENT_BUDGET_EXCEEDED");
    const ids = new Set(input.questions.map((q) => q.id));
    if (
      ids.size !== input.questions.length ||
      state.questions.some((q) => !ids.has(q.id))
    )
      fail("Questions must preserve unique identities and history.");
    if (
      input.processedFeedbackCount < state.processedFeedbackCount ||
      input.processedFeedbackCount > state.feedbacks.length
    )
      fail("Invalid processed feedback count.");
    state.questions = input.questions.map((q) => {
      const old = state.questions.find((x) => x.id === q.id);
      if (!old) return q;
      const { answer, skipped, ...content } = old;
      if (!isDeepStrictEqual(content, q))
        fail("Existing question content cannot change.");
      return {
        ...q,
        ...(answer === undefined ? {} : { answer }),
        ...(skipped === undefined ? {} : { skipped }),
      };
    });
    state.changes = input.changes;
    state.checks = input.checks;
    state.processedFeedbackCount = input.processedFeedbackCount;
    delete state.confirmation;
    await saveSolution(access, state);
    return { saved: true };
  },
});
