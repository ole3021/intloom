import * as z from "zod";
import {
  runIdSchema,
  specificationArtifactSchema,
} from "./specification-artifact.ts";
import {
  optionIdSchema,
  questionIdSchema,
  specificationAnsweredQuestionSchema,
  specificationChangeSchema,
  specificationFeedbackSchema,
} from "./specification-record.ts";

export const specificationQuestionSchema = z.strictObject({
  id: questionIdSchema,
  question: z.string().min(1),
  description: z.string().optional(),
  options: z
    .array(
      z.strictObject({
        id: optionIdSchema,
        label: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .optional(),
  answer: z.string().optional(),
  skipped: z.boolean().optional(),
  // Question content is immutable after creation; blocking questions require answers, while nonblocking questions may be skipped.
  isBlock: z.boolean(),
});

export const specificationBaselineSchema = z
  .strictObject({
    artifactId: z.string(),
    revision: z.number().int().positive(),
    data: specificationArtifactSchema,
  })
  .nullable();

export const specificationConfirmationContextSchema = z.strictObject({
  id: runIdSchema,
  intent: z.string().min(1),
  baseline: specificationBaselineSchema,
  changes: z.array(specificationChangeSchema),
  questions: z.array(specificationAnsweredQuestionSchema),
  feedbacks: z.array(specificationFeedbackSchema),
});

export const specificationConfirmationSchema = z.strictObject({
  context: specificationConfirmationContextSchema,
  confirmed: z.boolean(),
});

/** Runtime creates the initial State from the real run ID and intent text; Init loads its baseline. */
export const specificationStateSchema = z.strictObject({
  id: runIdSchema,
  intent: z.string().min(1),
  changes: z.array(specificationChangeSchema).default([]),
  questions: z.array(specificationQuestionSchema).default([]),
  feedbacks: z.array(specificationFeedbackSchema).default([]),
  processedFeedbackCount: z.number().int().nonnegative().default(0),
  proposalCount: z.number().int().nonnegative().optional(),
  baseline: specificationBaselineSchema.optional(),
  confirmation: specificationConfirmationSchema.optional(),
});

/** Agent cannot write answers, feedback, identity, baseline or confirmation. */
export const specificationProposalSchema = z.strictObject({
  changes: z.array(specificationChangeSchema),
  questions: z.array(
    specificationQuestionSchema.omit({ answer: true, skipped: true }),
  ),
  processedFeedbackCount: z.number().int().nonnegative(),
});

export type SpecificationState = z.infer<typeof specificationStateSchema>;
export type SpecificationQuestion = z.infer<typeof specificationQuestionSchema>;
export type SpecificationConfirmation = z.infer<
  typeof specificationConfirmationSchema
>;
export type SpecificationConfirmationContext = z.infer<
  typeof specificationConfirmationContextSchema
>;
export type SpecificationProposal = z.infer<typeof specificationProposalSchema>;
// The package boundary rejects explicit undefined; optional business fields must be omitted.
export default specificationStateSchema.transform((value, context) => {
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
