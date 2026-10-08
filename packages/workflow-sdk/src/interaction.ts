import type {
  UserAnswerConfirmation,
  UserAnswerQuestions,
  UserAskQuestions,
} from "./user-ask.ts";

/** Runtime binds the current Run and cursor and records waiting; answers are delivered only to the corresponding original call. */
export interface InteractionAccess {
  askQuestions(
    questions: Readonly<UserAskQuestions>,
  ): Promise<Readonly<UserAnswerQuestions>>;
  confirm(context: string): Promise<UserAnswerConfirmation>;
}
