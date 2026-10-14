import * as z from "zod";
import { basisSchema } from "../src/flow/shared.ts";
import {
  snapshotSchema,
  checkSchema,
  checkResultSchema,
  implementationChangeSchema,
} from "./engineering.ts";
import { specificationFeedbackSchema } from "./specification-record.ts";
export const implementationStateSchema = z.strictObject({
  id: z.string().startsWith("RUN-"),
  intent: z.string(),
  specification: basisSchema.optional(),
  solution: basisSchema.optional(),
  initialSnapshot: snapshotSchema.optional(),
  changes: z.array(implementationChangeSchema).default([]),
  feedbacks: z.array(specificationFeedbackSchema).default([]),
  checks: z.array(checkSchema).default([]),
  iterations: z.number().int().nonnegative().default(0),
  processedFeedbackCount: z.number().int().nonnegative().default(0),
  checkedSnapshot: snapshotSchema.optional(),
  checkResults: z.array(checkResultSchema).default([]),
});
export type ImplementationState = z.infer<typeof implementationStateSchema>;
export const implementationProposalSchema = z.strictObject({
  changes: z.array(implementationChangeSchema),
  processedFeedbackCount: z.number().int().nonnegative(),
});
export const implementationSubmissionResultSchema = z.discriminatedUnion(
  "saved",
  [
    z.strictObject({ saved: z.literal(true) }),
    z.strictObject({
      saved: z.literal(false),
      feedback: z.strictObject({
        rule: z.literal("IMPLEMENTATION_CHANGE_LIST_INVALID"),
        changedPaths: z.array(z.string()),
        missingPaths: z.array(z.string()),
        unchangedPaths: z.array(z.string()),
        validOriginRefs: z.array(z.string()),
        unknownOriginRefs: z.array(z.string()),
        expectedFeedbackCount: z.number().int().nonnegative(),
        feedbackUnprocessed: z.boolean(),
      }),
    }),
  ],
);
export const implementationRecordSchema = z.strictObject({
  id: z.string(),
  intent: z.string(),
  specification: basisSchema,
  solution: basisSchema,
  changes: z.array(implementationChangeSchema),
  feedbacks: z.array(specificationFeedbackSchema),
  initialSnapshot: snapshotSchema,
  fileSnapshot: snapshotSchema,
  checks: z.array(checkResultSchema),
  resultDigest: z.string(),
});
export default implementationStateSchema.transform((value, context) => {
  const result = z.json().safeParse(value);
  if (!result.success) {
    context.addIssue({
      code: "custom",
      message: "State must contain JSON values only; omit undefined fields",
    });
    return z.NEVER;
  }
  return result.data;
});
