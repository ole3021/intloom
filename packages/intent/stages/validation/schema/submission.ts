import * as z from "zod";
import {
  text,
  refs,
  evidenceUseSchema,
  questionSchema,
} from "../../../src/schema/common.ts";
import {
  assessmentSchema,
  supplementarySchema,
} from "../../../src/schema/verification.ts";
export const findingSchema = z.strictObject({
  id: text,
  description: text,
  targetRefs: refs,
  evidence: z.array(evidenceUseSchema).min(1),
});
export const findingUpdateSchema = z.strictObject({
  findingRef: text,
  previousAssessmentRef: text,
  outcome: z.enum([
    "present",
    "resolved",
    "no_longer_applicable",
    "unverified",
    "invalidated",
  ]),
  explanation: text,
  targetRefs: refs,
  evidence: z.array(evidenceUseSchema),
});
const body = z.strictObject({
  revision: z.number(),
  candidateRef: text,
  assessments: z.array(assessmentSchema),
  findings: z.array(findingSchema),
  findingUpdates: z.array(findingUpdateSchema),
});
export const assessmentSubmissionSchema = z.discriminatedUnion("kind", [
  body.extend({ kind: z.literal("ready") }),
  body.extend({
    kind: z.literal("needs_evidence"),
    requests: z.array(supplementarySchema).min(1),
  }),
  body.extend({
    kind: z.literal("needs_input"),
    questions: z.array(questionSchema).min(1),
  }),
]);
export const collectionDecisionSchema = z.strictObject({
  id: text,
  interactionRef: text,
  reviewRef: text,
  reviewDigest: text,
  review: z.json(),
  basisDigest: text,
  candidateRef: text,
  verificationRefs: refs,
  informationRequestRefs: refs,
  evidenceGapRefs: refs,
  decision: z.literal("stop_collection"),
  decidedAt: text,
});
export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>;
