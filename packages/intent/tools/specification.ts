import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { readInitializedState } from "../src/specification/state.ts";
import { submitProposal } from "../src/specification/proposal.ts";
import { specificationProposalSchema } from "../schemas/specification-state.ts";

export const readSpecification = defineAgentTool({
  id: "read_specification",
  description:
    "Read this Run's original Intent, committed specification baseline, cumulative draft, actual answers, and feedback.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) =>
    z.json().parse(await readInitializedState(access)),
});

export const submitSpecification = defineAgentTool({
  id: "submit_specification",
  description:
    "Save cumulative Changes and all questions as a whole. Preserve existing question content and skip permissions; Code records actual answers and skips. This does not commit formal data. processedFeedbackCount is the number of feedback entries read and processed.",
  inputSchema: specificationProposalSchema,
  outputSchema: z.strictObject({ saved: z.boolean() }),
  execute: async (input, access) => submitProposal(input, access),
});
