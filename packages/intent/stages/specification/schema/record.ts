import * as z from "zod";
import {
  text,
  baselineSchema,
  analysisSchema,
  approvalSchema,
  editAuditSchema,
  interactionSchema,
  evidenceSchema,
} from "../../../src/schema/common.ts";
import { specificationArtifactSchema } from "./artifact.ts";
import { scopeSchema } from "./submission.ts";
export const specificationRecordSchema = z.strictObject({
  runId: text,
  prompt: z.string().refine((value) => value.trim().length > 0),
  baseline: baselineSchema,
  snapshot: specificationArtifactSchema,
  analysis: analysisSchema,
  scope: scopeSchema,
  edits: z.array(editAuditSchema),
  interactions: z.array(interactionSchema),
  evidence: z.array(evidenceSchema),
  approval: approvalSchema,
  digest: text,
});
export type SpecificationRecord = z.infer<typeof specificationRecordSchema>;
export default specificationRecordSchema;
