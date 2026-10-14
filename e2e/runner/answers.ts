import * as z from "zod";
import {
  userAskQuestionsSchema,
  userAnswerQuestionsSchema,
  userAnswerConfirmationSchema,
} from "@intloom/workflow-sdk";
import type { Run } from "./contracts.ts";

const context = {
  runId: z.string().min(1),
  actionId: z.string().min(1),
  knowledgeRefs: z.array(z.string().min(1)).min(1),
  decision: z.string().min(1),
};
export const questionSubmissionSchema = z.strictObject({
  ...context,
  answers: userAnswerQuestionsSchema,
});
export const confirmationSubmissionSchema = z.strictObject({
  ...context,
  ...userAnswerConfirmationSchema.shape,
});
export const answerTools = {
  submit_questions: questionSubmissionSchema,
  submit_confirmation: confirmationSubmissionSchema,
};
export type AnswerTool = keyof typeof answerTools;
export interface ModelToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}
export function validateAnswer(run: Run, kind: string, answer: unknown) {
  const action = run.pendingAction;
  if (!action || action.kind !== kind)
    throw new Error("Use the tool matching the current pending action kind.");
  if (kind === "user_ask_confirmation")
    return userAnswerConfirmationSchema.parse(answer);
  const questions = userAskQuestionsSchema.parse(action.request);
  const answers = userAnswerQuestionsSchema.parse(answer);
  if (
    answers.length !== questions.length ||
    new Set(answers.map((item) => item.questionId)).size !== answers.length
  )
    throw new Error("Answer every requested question exactly once.");
  for (const item of answers) {
    const question = questions.find((part) => part.id === item.questionId);
    if (!question) throw new Error(`Unknown question ID: ${item.questionId}.`);
    if (item.isSkipped && !question.isSkippable)
      throw new Error(`Question ${item.questionId} cannot be skipped.`);
  }
  return answers;
}
export function validationIssues(cause: unknown): string[] {
  return cause instanceof z.ZodError
    ? cause.issues.map(
        (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
      )
    : [cause instanceof Error ? cause.message : "Invalid answer input."];
}
