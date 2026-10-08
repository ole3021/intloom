import * as z from "zod";
import { basisSchema } from "../src/flow/shared.ts";
import {
  specificationPatchSchema,
  specificationFeedbackSchema,
} from "./specification-record.ts";
import { specificationQuestionSchema } from "./specification-state.ts";
import type { solutionArtifactSchema } from "./solution-artifact.ts";
import { checkSchema } from "./engineering.ts";
export const solutionChangeSchema = z.strictObject({
  target_ref: z
    .string()
    .regex(/^O(APP|PKG|MOD|RES|REL|SCN|CON|DEC|RISK|DIAG)-.+/),
  reason: z.string().trim().min(1),
  patch: z.array(specificationPatchSchema).min(1),
});
export const solutionProposalSchema = z.strictObject({
  changes: z.array(solutionChangeSchema),
  questions: z.array(
    specificationQuestionSchema.omit({ answer: true, skipped: true }),
  ),
  processedFeedbackCount: z.number().int().nonnegative(),
  checks: z.array(checkSchema).min(1),
});
export const solutionStateSchema = z.strictObject({
  id: z.string().startsWith("RUN-"),
  intent: z.string(),
  specification: basisSchema.optional(),
  baseline: basisSchema.nullable().optional(),
  changes: z.array(solutionChangeSchema).default([]),
  questions: z.array(specificationQuestionSchema).default([]),
  feedbacks: z.array(specificationFeedbackSchema).default([]),
  processedFeedbackCount: z.number().int().nonnegative().default(0),
  checks: z.array(checkSchema).default([]),
  iterations: z.number().int().nonnegative().default(0),
  confirmation: z
    .strictObject({ digest: z.string(), confirmed: z.boolean() })
    .optional(),
});
export type SolutionState = z.infer<typeof solutionStateSchema>;
export const solutionRecordSchema = z.strictObject({
  id: z.string(),
  intent: z.string(),
  basis: basisSchema,
  resultDigest: z.string(),
  changes: z.array(solutionChangeSchema),
  origin_refs: z.array(z.string()),
  questions: z.array(
    specificationQuestionSchema.pick({
      id: true,
      question: true,
      description: true,
      answer: true,
    }),
  ),
  feedbacks: z.array(specificationFeedbackSchema),
  checks: z.array(checkSchema),
});
export const emptySolution = (): z.infer<typeof solutionArtifactSchema> => ({
  structure: { apps: [], packages: [], resources: [], relations: [] },
  scenarios: [],
  concepts: [],
  decisions: [],
  risks: [],
  diagrams: [],
});
export default solutionStateSchema.transform((value, context) => {
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
