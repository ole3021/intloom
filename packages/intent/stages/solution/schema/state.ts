import { json } from "../../../src/json.ts";
import * as z from "zod";
import {
  baseStateSchema,
  recordRefSchema,
  baselineSchema,
  analysisSchema,
  approvalSchema,
  editAuditSchema,
  text,
} from "../../../src/schema/common.ts";
import { specificationRecordSchema } from "../../specification/schema/record.ts";
import { solutionArtifactSchema } from "./artifact.ts";
import { planSchema } from "./submission.ts";
export const solutionStateSchema = baseStateSchema.extend({
  specificationRef: recordRefSchema.optional(),
  specification: specificationRecordSchema.optional(),
  baseline: baselineSchema.optional(),
  draft: solutionArtifactSchema.optional(),
  analysis: analysisSchema.optional(),
  plan: planSchema.optional(),
  aliases: z.record(z.string(), z.string()).default({}),
  edits: z.array(editAuditSchema).default([]),
  reviewDigest: text.optional(),
  approval: approvalSchema.optional(),
});
export type SolutionState = z.infer<typeof solutionStateSchema>;
export default solutionStateSchema.transform((value) => json(value));
