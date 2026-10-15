import { solutionContextSchema } from "../schema/context.ts";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { resultSchema } from "../../../src/schema/common.ts";
import {
  analyzeInputSchema,
  editInputSchema,
  designInputSchema,
} from "../schema/submission.ts";
import { readContext, analyze, edit, submit } from "../src/actions.ts";
export const readSolutionContext = defineAgentTool({
  id: "read_solution_context",
  description:
    "Read the assigned task, exact revision, fixed sources, actual answers and current draft. Read before editing or submitting.",
  inputSchema: z.strictObject({}),
  outputSchema: solutionContextSchema,
  execute: readContext,
});
export const submitSolutionAnalysis = defineAgentTool({
  id: "submit_solution_analysis",
  description:
    "Submit analysis with source-backed facts and actual information gaps. Analysis does not edit the draft. On saved=true finish this invocation with the returned outcome.",
  inputSchema: analyzeInputSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: analyze,
});
export const editSolution = defineAgentTool({
  id: "edit_solution",
  description:
    "Batch-edit only changed objects using complete editable values and reasons. New IDs must be $temporary keys; mutually dependent objects belong in one batch. Code allocates IDs and resolves references. Retire existing objects instead of deleting history. Use the returned revision and IDs for subsequent calls.",
  inputSchema: editInputSchema,
  outputSchema: resultSchema,
  execute: edit,
});
export const submitSolution = defineAgentTool({
  id: "submit_solution",
  description:
    "Submit the complete round design contract using the current revision. Use $temporary keys for new plan or round objects; use formal IDs returned by context for existing sources. On saved=true finish with the returned outcome. Saving is not user confirmation or formal publication.",
  inputSchema: designInputSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: submit,
});
