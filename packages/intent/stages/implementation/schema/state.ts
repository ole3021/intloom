import { json } from "../../../src/json.ts";
import * as z from "zod";
import {
  baseStateSchema,
  recordRefSchema,
  candidateSchema,
  text,
  refs,
  approvalSchema,
} from "../../../src/schema/common.ts";
import { verificationEntrySchema } from "../../../src/schema/verification.ts";
import { specificationRecordSchema } from "../../specification/schema/record.ts";
import { solutionRecordSchema } from "../../solution/schema/record.ts";
import { implementationSubmissionSchema } from "./submission.ts";
export const changeSchema = z.strictObject({
  id: text,
  candidateRef: text,
  path: text,
  kind: z.enum(["add", "modify", "remove"]),
  beforeDigest: text.nullable(),
  afterDigest: text.nullable(),
  operationRefs: refs,
});
export const implementationStateSchema = baseStateSchema.extend({
  specification: specificationRecordSchema.optional(),
  solution: solutionRecordSchema.optional(),
  solutionRef: recordRefSchema.optional(),
  baseline: candidateSchema.optional(),
  candidate: candidateSchema.optional(),
  changes: z.array(changeSchema).default([]),
  verifications: z.array(verificationEntrySchema).default([]),
  submission: implementationSubmissionSchema.optional(),
  observationRef: text.optional(),
  reviewDigest: text.optional(),
  partialApproval: approvalSchema.optional(),
  externalApproval: approvalSchema.optional(),
  checkedDigest: text.optional(),
});
export type ImplementationState = z.infer<typeof implementationStateSchema>;
export default implementationStateSchema.transform((value) => json(value));
