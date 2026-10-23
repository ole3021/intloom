import { json } from "../../../src/json.ts";
import * as z from "zod";
import {
  baseStateSchema,
  baselineSchema,
  analysisSchema,
  approvalSchema,
  editAuditSchema,
  text,
} from "../../../src/schema/common.ts";
import { specificationArtifactSchema } from "./artifact.ts";
import { scopeSchema } from "./submission.ts";
export const specificationStateSchema = baseStateSchema.extend({
  baseline: baselineSchema.optional(),
  draft: specificationArtifactSchema.optional(),
  analysis: analysisSchema.optional(),
  scope: scopeSchema.optional(),
  aliases: z.record(z.string(), z.string()).default({}),
  edits: z.array(editAuditSchema).default([]),
  reviewDigest: text.optional(),
  approval: approvalSchema.optional(),
});
export type SpecificationState = z.infer<typeof specificationStateSchema>;
export default specificationStateSchema.transform((value) => json(value));
