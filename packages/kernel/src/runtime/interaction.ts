import { generateId } from "@intloom/utils";
import * as z from "zod";
import type { PendingUserAction, PendingUserActionKind } from "./run-view.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { InteractionAccess } from "../effector/interaction.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { assertCallOwnership } from "./call-scope.ts";
import { notifyRunObservers, type RunEntry } from "./run-entry.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  userAnswerQuestionsSchema,
  userAnswerConfirmationSchema,
} from "../effector/schemas/user-ask.ts";

/** Independent of clients; the host presents RunView actions and submits answers through answerAsk. */
export function createInteraction(
  entry: RunEntry,
  call: object,
): InteractionAccess {
  return Object.freeze({
    askQuestions(questions) {
      const request = parseRequest(() => {
        const parsed = userAskQuestionsSchema.parse(questions);
        unique(parsed.map((question) => question.id));
        for (const question of parsed)
          unique(question.options?.map((option) => option.id) ?? []);
        return parsed;
      });
      return ask(
        entry,
        call,
        "user_ask_questions",
        request,
        validateQuestionsAnswer,
      );
    },
    confirm(context) {
      const request = parseRequest(() =>
        userAskConfirmationSchema.parse({ context }),
      );
      return ask(
        entry,
        call,
        "user_ask_confirmation",
        request,
        (_action, answer) => userAnswerConfirmationSchema.parse(answer),
      );
    },
  } satisfies InteractionAccess);
}

function parseRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch (cause) {
    throw RUNTIME_ERRORS.wrap("STEP_INTERACTION_INVALID", cause);
  }
}

function unique(ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length)
    throw new Error("Question and per-question option IDs must be unique.");
}

function validateQuestionsAnswer(
  action: PendingUserAction,
  input: ReadonlyJsonValue,
) {
  // Reads requests only from the authoritative action; continuations keep no duplicate request or action identity.
  const questions = userAskQuestionsSchema.parse(action.request);
  const answers = userAnswerQuestionsSchema.parse(input);
  unique(answers.map((answer) => answer.questionId));
  if (answers.length !== questions.length)
    throw new Error("Every requested question must be answered exactly once.");
  const requested = new Map(
    questions.map((question) => [question.id, question]),
  );
  for (const answer of answers) {
    const question = requested.get(answer.questionId);
    if (!question)
      throw new Error("The answer contains an unknown question ID.");
    if (answer.isSkipped && !question.isSkippable)
      throw new Error("This question cannot be skipped.");
  }
  return answers;
}

/** Restores only the interaction delivery; it never calls the original Code. */
export function restoreInteraction(entry: RunEntry, deliver: () => void): void {
  entry.reply = {
    prepare(action, answer) {
      validateSavedAnswer(action, answer);
      return deliver;
    },
    reject() {},
  };
  entry.waitStartedAt = performance.now();
}

export function validateSavedAction(action: PendingUserAction): void {
  if (action.kind === "user_ask_confirmation") {
    userAskConfirmationSchema.parse(action.request);
    return;
  }
  const questions = userAskQuestionsSchema.parse(action.request);
  unique(questions.map((question) => question.id));
  for (const question of questions)
    unique(question.options?.map((option) => option.id) ?? []);
}

export function validateSavedAnswer(
  action: PendingUserAction,
  answer: ReadonlyJsonValue,
): void {
  validateSavedAction(action);
  if (action.kind === "user_ask_questions")
    validateQuestionsAnswer(action, answer);
  else userAnswerConfirmationSchema.parse(answer);
}

function ask<T>(
  entry: RunEntry,
  call: object,
  kind: PendingUserActionKind,
  request: unknown,
  parseAnswer: (action: PendingUserAction, answer: ReadonlyJsonValue) => T,
): Promise<T> {
  assertCallOwnership(entry, call);
  if (
    entry.state.status !== "running" ||
    entry.state.pendingAction ||
    entry.reply
  ) {
    throw RUNTIME_ERRORS.create("STEP_INTERACTION_INVALID", {
      message: "One execution may have only one unanswered interaction.",
    });
  }
  // The request Schema constrains field types; omit optional undefined values and detach caller-owned references.
  const serialized: unknown = JSON.parse(JSON.stringify(request));
  const action: PendingUserAction = {
    id: generateId("ASK"),
    flowName: entry.state.flowName,
    cursor: { ...entry.state.cursor },
    kind,
    request: z.json().parse(serialized),
    createdAt: new Date().toISOString(),
  };
  const answer = new Promise<T>((resolve, reject) => {
    entry.reply = {
      prepare(currentAction, input) {
        const parsed = parseAnswer(currentAction, input);
        return () => resolve(parsed);
      },
      reject,
    };
  });
  // Handle rejections from unawaited interaction on failure or stop; the original Promise still rejects.
  void answer.catch(() => {});
  entry.state.pendingAction = action;
  entry.state.status = "waiting";
  entry.state.updatedAt = new Date(action.createdAt);
  delete entry.recoveredAnswer;
  saveCheckpoint(entry, "waiting");
  entry.waitStartedAt = performance.now();
  (entry.activeLog ?? entry.logger).info("run_waiting", {
    actionId: action.id,
    kind,
  });
  notifyRunObservers(entry);
  return answer;
}
