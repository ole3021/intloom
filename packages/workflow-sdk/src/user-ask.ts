import * as z from "zod";

const questionOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

const questionSchema = z.strictObject({
  id: z.string().min(1),
  question: z.string().min(1),
  description: z.string().optional(),
  options: z.array(questionOptionSchema).optional(),
  isSkippable: z.boolean(),
});

/** Questions form a flat list; Runtime records Run and cursor ownership in PendingUserAction. */
export const userAskQuestionsSchema = z.array(questionSchema).min(1);

/** The interaction layer resolves options to text; each question has one text answer or an explicit skip. */
export const userAnswerQuestionsSchema = z.array(
  z.discriminatedUnion("isSkipped", [
    z.strictObject({
      questionId: z.string().min(1),
      isSkipped: z.literal(true),
    }),
    z.strictObject({
      questionId: z.string().min(1),
      isSkipped: z.literal(false),
      answer: z.string().refine((value) => value.trim().length > 0, {
        message: "An answer must contain non-whitespace text.",
      }),
    }),
  ]),
);

export const userAskConfirmationSchema = z.strictObject({
  context: z.string().min(1),
});

export const userAnswerConfirmationSchema = z.strictObject({
  isConfirmed: z.boolean(),
  feedback: z.string().optional(),
});

export type UserAskQuestions = z.infer<typeof userAskQuestionsSchema>;
export type UserAnswerQuestions = z.infer<typeof userAnswerQuestionsSchema>;
export type UserAskConfirmation = z.infer<typeof userAskConfirmationSchema>;
export type UserAnswerConfirmation = z.infer<
  typeof userAnswerConfirmationSchema
>;
