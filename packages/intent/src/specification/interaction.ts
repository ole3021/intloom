import type {
  CodeExecutionAccess,
  InteractionAccess,
  JsonValue,
  UserAnswerConfirmation,
  UserAnswerQuestions,
  UserAskQuestions,
} from "@intloom/workflow-sdk";
import {
  userAnswerConfirmationSchema,
  userAnswerQuestionsSchema,
} from "@intloom/workflow-sdk";
import { fail } from "./errors.ts";

export type QuestionRequest = UserAskQuestions[number];
export type IntentInteraction = InteractionAccess;
export type IntentCodeAccess = CodeExecutionAccess<JsonValue>;
export const answersSchema = userAnswerQuestionsSchema;
export const confirmationAnswerSchema = userAnswerConfirmationSchema;
export type IntentAnswer = UserAnswerQuestions[number];
export type IntentConfirmationAnswer = UserAnswerConfirmation;

export function interaction(
  access: CodeExecutionAccess<JsonValue>,
): IntentInteraction {
  if (!("interaction" in access))
    fail("Runtime must bind IntentInteraction", "MISSING_INTENT_CAPABILITY");
  const value = access.interaction;
  if (
    !value ||
    typeof value !== "object" ||
    !("askQuestions" in value) ||
    typeof value.askQuestions !== "function" ||
    !("confirm" in value) ||
    typeof value.confirm !== "function"
  )
    fail("Invalid IntentInteraction binding", "MISSING_INTENT_CAPABILITY");
  return value as IntentInteraction;
}
