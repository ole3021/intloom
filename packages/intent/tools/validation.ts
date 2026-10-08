import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { validationProposalSchema } from "../schemas/validation-state.ts";
import { readValidation } from "../src/validation/review.ts";
import { json } from "../src/flow/shared.ts";
export const readValidationContext = defineAgentTool({
  id: "read_validation",
  description:
    "Read the fixed requirement/design scope, code hashes and independently executed host check results. Inspect actual code and test coverage; passed commands alone do not prove every requirement. Do not edit product files.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => json(readValidation(access)),
});
export const submitValidation = defineAgentTool({
  id: "submit_validation",
  description:
    "Submit one check for every scoped object, evidence linked to its target, real test statuses and findings. Reference commandResults by checkId for executed evidence. Use undone when evidence is missing. No aggregate counts or repair claims are accepted.",
  inputSchema: validationProposalSchema,
  outputSchema: z.strictObject({ saved: z.boolean() }),
  execute: async (input, access) => {
    const state = readValidation(access);
    state.proposal = input;
    await access.state.update(json(state));
    return { saved: true };
  },
});
