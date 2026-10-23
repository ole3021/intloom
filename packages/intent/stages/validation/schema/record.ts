import * as z from "zod";
import {
  text,
  recordRefSchema,
  candidateSchema,
  evidenceSchema,
  interactionSchema,
} from "../../../src/schema/common.ts";
import {
  targetSchema,
  verificationEntrySchema,
  assessmentSchema,
} from "../../../src/schema/verification.ts";
import {
  findingSchema,
  findingUpdateSchema,
  collectionDecisionSchema,
} from "./submission.ts";
export const summarySchema = z.strictObject({
  verdict: z.enum(["passed", "failed", "partial", "undone"]),
  counts: z.strictObject({
    passed: z.number(),
    failed: z.number(),
    unverified: z.number(),
    total: z.number(),
  }),
  limitations: z.array(text),
});
export const validationRecordSchema = z.strictObject({
  runId: text,
  prompt: z.string().refine((value) => value.trim().length > 0),
  basis: z.strictObject({
    specification: recordRefSchema,
    solution: recordRefSchema,
    implementation: recordRefSchema,
  }),
  candidate: candidateSchema,
  scope: z.strictObject({ targets: z.array(targetSchema) }),
  verifications: z.array(verificationEntrySchema),
  assessments: z.array(assessmentSchema),
  findings: z.array(findingSchema),
  findingUpdates: z.array(findingUpdateSchema),
  evidence: z.array(evidenceSchema),
  interactions: z.array(interactionSchema),
  collectionDecisions: z.array(collectionDecisionSchema),
  check: z.strictObject({ digest: text, issues: z.array(text) }),
  summary: summarySchema,
  digest: text,
});
export type ValidationRecord = z.infer<typeof validationRecordSchema>;
export default validationRecordSchema;
