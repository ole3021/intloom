import { json } from "../../../src/json.ts";
import * as z from "zod";
import {
  baseStateSchema,
  recordRefSchema,
  baselineSchema,
  candidateSchema,
  text,
} from "../../../src/schema/common.ts";
import {
  targetSchema,
  verificationEntrySchema,
} from "../../../src/schema/verification.ts";
import { implementationRecordSchema } from "../../implementation/schema/record.ts";
import {
  assessmentSubmissionSchema,
  collectionDecisionSchema,
} from "./submission.ts";
import { validationArtifactSchema } from "./artifact.ts";
export const validationStateSchema = baseStateSchema.extend({
  implementation: implementationRecordSchema.optional(),
  implementationRef: recordRefSchema.optional(),
  candidate: candidateSchema.optional(),
  targets: z.array(targetSchema).default([]),
  verifications: z.array(verificationEntrySchema).default([]),
  baseline: baselineSchema.optional(),
  history: validationArtifactSchema.optional(),
  submission: assessmentSubmissionSchema.optional(),
  aliases: z.record(z.string(), z.string()).default({}),
  observationRef: text.optional(),
  stopRequested: z.boolean().default(false),
  resolutionChoice: z.enum(["continue_collection"]).optional(),
  collectionDecisions: z.array(collectionDecisionSchema).default([]),
  checkedDigest: text.optional(),
});
export type ValidationState = z.infer<typeof validationStateSchema>;
export default validationStateSchema.transform((value) => json(value));
