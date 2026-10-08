import * as z from "zod";
import {
  runIdSchema,
  specificationObjectIdSchema,
} from "./specification-artifact.ts";

const patchPathSchema = z.union([
  z.literal(""),
  z.templateLiteral(["/", z.string()]),
]);

/** Validates patch structure only; business Code checks path decoding, old-value tests, and target mutation permissions. */
export const specificationPatchSchema = z.union([
  z.strictObject({
    op: z.enum(["test", "add", "replace"]),
    path: patchPathSchema,
    value: z.json(),
  }),
  z.strictObject({
    op: z.literal("remove"),
    path: patchPathSchema,
  }),
]);

export const specificationChangeSchema = z.strictObject({
  target_ref: specificationObjectIdSchema,
  reason: z.string().trim().min(1),
  patch: z.array(specificationPatchSchema).min(1),
});

export const questionIdSchema = z.templateLiteral(["QST-", z.number()]);
export const optionIdSchema = z.templateLiteral([
  questionIdSchema,
  ":",
  z.string(),
]);

export const specificationAnsweredQuestionSchema = z.strictObject({
  id: questionIdSchema,
  question: z.string(),
  description: z.string().optional(),
  answer: z.string(),
});

export const specificationFeedbackSchema = z.strictObject({
  source: z.enum(["user", "check"]),
  content: z.string(),
});

export const specificationRecordSchema = z.strictObject({
  id: runIdSchema,
  intent: z.string(),
  resultDigest: z.string().optional(),
  origin_refs: z.array(specificationObjectIdSchema),
  changes: z.array(specificationChangeSchema),
  questions: z.array(specificationAnsweredQuestionSchema),
  feedbacks: z.array(specificationFeedbackSchema),
});

export type SpecificationPatch = z.infer<typeof specificationPatchSchema>;
export type SpecificationChange = z.infer<typeof specificationChangeSchema>;
export type QuestionId = z.infer<typeof questionIdSchema>;
export type OptionId = z.infer<typeof optionIdSchema>;
export type SpecificationAnsweredQuestion = z.infer<
  typeof specificationAnsweredQuestionSchema
>;
export type SpecificationFeedback = z.infer<typeof specificationFeedbackSchema>;
export type SpecificationRecord = z.infer<typeof specificationRecordSchema>;

export default specificationRecordSchema;
