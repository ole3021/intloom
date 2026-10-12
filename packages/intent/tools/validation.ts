import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import {
  validationProposalSchema,
  validationSubmissionResultSchema,
} from "../schemas/validation-state.ts";
import {
  readValidation,
  reviewValidation,
  ValidationReportRejected,
} from "../src/validation/review.ts";
import { fail, json } from "../src/flow/shared.ts";
export const readValidationContext = defineAgentTool({
  id: "read_validation",
  description:
    "Read the fixed requirement/design scope, code hashes, independently executed host check results and remaining submission feedback. Inspect actual code and test coverage; passed commands alone do not prove every requirement. Do not edit product files.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => json(readValidation(access)),
});
export const submitValidation = defineAgentTool({
  id: "submit_validation",
  description:
    "Submit one check for every scoped object, evidence linked to its target, real test statuses and findings. Use method code for source inspection without an executed command. Methods test/runtime_observation/static_analysis require an exact commandResults ID as checkId; do not invent or borrow unrelated command evidence. Use partial or undone when support is incomplete or missing. No aggregate counts or repair claims are accepted. If saved is false, correct only the reported draft issue and resubmit once. Return ready only after saved is true; do not edit product files.",
  inputSchema: validationProposalSchema,
  outputSchema: validationSubmissionResultSchema,
  execute: async (
    input,
    access,
  ): Promise<z.infer<typeof validationSubmissionResultSchema>> => {
    const state = readValidation(access);
    if (state.proposal || state.submissionCount >= 2)
      fail(
        "Validation allows one submission and at most one report correction.",
        "INTENT_BUDGET_EXCEEDED",
      );
    state.submissionCount += 1;
    try {
      await reviewValidation(access, { ...state, proposal: input });
    } catch (error) {
      if (!(error instanceof ValidationReportRejected)) throw error;
      state.submissionFeedback = error.feedback;
      await access.state.update(json(state));
      if (state.submissionCount === 2) throw error;
      return { saved: false, attemptsRemaining: 1, feedback: error.feedback };
    }
    state.proposal = input;
    delete state.submissionFeedback;
    await access.state.update(json(state));
    return { saved: true };
  },
});
