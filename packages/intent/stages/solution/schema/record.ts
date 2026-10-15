import * as z from "zod";
import {
  text,
  recordRefSchema,
  baselineSchema,
  analysisSchema,
  approvalSchema,
  editAuditSchema,
  interactionSchema,
  evidenceSchema,
} from "../../../src/schema/common.ts";
import { targetSchema } from "../../../src/schema/verification.ts";
import { solutionArtifactSchema } from "./artifact.ts";
import { planSchema } from "./submission.ts";
export const solutionRecordSchema = z.strictObject({
  runId: text,
  prompt: z.string().refine((value) => value.trim().length > 0),
  basis: z.strictObject({ specification: recordRefSchema }),
  baseline: baselineSchema,
  snapshot: solutionArtifactSchema,
  analysis: analysisSchema,
  plan: planSchema,
  targets: z.array(targetSchema),
  edits: z.array(editAuditSchema),
  interactions: z.array(interactionSchema),
  evidence: z.array(evidenceSchema),
  approval: approvalSchema,
  digest: text,
});
export type SolutionRecord = z.infer<typeof solutionRecordSchema>;
export default solutionRecordSchema;
