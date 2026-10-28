import { isDeepStrictEqual } from "node:util";
import {
  interactionRequestSchema,
  interactionResponse,
  parseSchemaValue,
} from "@intloom/loom-sdk";
import { generateId } from "@intloom/utils";
import * as z from "zod";
import type { PendingUserAction, PendingUserActionKind } from "./run-view.ts";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { InteractionAccess } from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";
import { assertCallOwnership } from "./call-scope.ts";
import { notifyRunObservers, type RunEntry } from "./run-entry.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  userAnswerQuestionsSchema,
  userAnswerConfirmationSchema,
} from "@intloom/loom-sdk";

/** Independent of clients; the host presents RunView actions and submits answers through submitAnswer. */
export function createInteraction(
  entry: RunEntry,
  call: object,
): InteractionAccess {
  return Object.freeze({
    receipt(id) {
      assertCallOwnership(entry, call);
      const receipt = entry.state.interactionReceipts?.find(
        (item) => item.id === id,
      );
      return receipt && structuredClone(receipt);
    },
    latest(id) {
      assertCallOwnership(entry, call);
      const receipt = entry.state.interactionReceipts?.findLast(
        (item) => item.request.interactionId === id,
      );
      return receipt && structuredClone(receipt);
    },
    request(input) {
      const request = parseRequest(() => {
        const value = interactionRequestSchema.parse(input);
        const capability = entry.blueprint.capability;
        const definition =
          capability?.definition.interactions[value.interactionId];
        if (!definition || !isDeepStrictEqual(definition, value.definition))
          throw ERRORS.create("CAPABILITY_DENIED");
        const step = capability.plan.steps.find(
          (step) => step.id === entry.state.cursor.stepName,
        );
        if (
          step?.kind === "agent" &&
          !capability.definition.agents[step.agent]?.interactions.includes(
            value.interactionId,
          )
        )
          throw ERRORS.create("CAPABILITY_DENIED");
        return {
          ...value,
          context: parseSchemaValue(definition.context, value.context),
        };
      });
      return ask(
        entry,
        call,
        "user_ask_interaction",
        request,
        (action, answer) => {
          const current = interactionRequestSchema.parse(action.request);
          const parsed = parseSchemaValue(
            interactionResponse(current.definition),
            answer,
          );
          validateInteractionAnswer(entry, current, parsed);
          return parsed;
        },
      );
    },
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
    throw ERRORS.wrap("STEP_INTERACTION_INVALID", cause);
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

/** Checks the answer against the canonical definition and the saved request context before consumption. */
export function validateInteractionAnswer(
  entry: RunEntry,
  request: import("@intloom/loom-sdk").InteractionRequest,
  answer: ReadonlyJsonValue,
) {
  const canonical =
    entry.blueprint.capability?.definition.interactions[request.interactionId];
  if (!canonical || !isDeepStrictEqual(canonical, request.definition))
    throw ERRORS.create("RUN_STATE_INVALID");
  if (canonical.validate) {
    const validator =
      entry.blueprint.capability?.validators?.[canonical.validate];
    if (!validator) throw ERRORS.create("RUN_STATE_INVALID");
    const result = z
      .strictObject({ passed: z.boolean(), message: z.string().optional() })
      .parse(
        validator(structuredClone(answer), structuredClone(request.context)),
      );
    if (!result.passed)
      throw new Error(
        result.message ?? "The answer is not valid for this request",
      );
  }
}

/** Restores only interaction delivery; it never calls the original Code. */
export function restoreInteraction(entry: RunEntry, deliver: () => void): void {
  entry.reply = {
    prepare(action, answer) {
      validateSavedAnswer(action, answer);
      if (action.kind === "user_ask_interaction")
        validateInteractionAnswer(
          entry,
          interactionRequestSchema.parse(action.request),
          answer,
        );
      return deliver;
    },
    reject() {},
  };
  entry.waitStartedAt = performance.now();
}

export function validateSavedAction(action: PendingUserAction): void {
  if (action.kind === "user_ask_interaction") {
    const request = interactionRequestSchema.parse(action.request);
    parseSchemaValue(request.definition.context, request.context);
    return;
  }
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
  else if (action.kind === "user_ask_interaction") {
    const request = interactionRequestSchema.parse(action.request);
    parseSchemaValue(interactionResponse(request.definition), answer);
  } else userAnswerConfirmationSchema.parse(answer);
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
    (entry.state.status !== "running" &&
      !(
        kind === "user_ask_interaction" &&
        entry.state.status === "waiting" &&
        entry.state.pendingAgentCall
      )) ||
    entry.state.pendingAction ||
    entry.reply
  ) {
    throw ERRORS.create("STEP_INTERACTION_INVALID", {
      message: "One execution may have only one unanswered interaction.",
    });
  }
  // The request Schema constrains field types; omit optional undefined values and detach caller-owned references.
  const serialized: unknown = JSON.parse(JSON.stringify(request));
  const action: PendingUserAction = {
    id: generateId("ASK"),
    loomName: entry.state.loomName,
    cursor: { ...entry.state.cursor },
    kind,
    request: z.json().parse(serialized),
    createdAt: new Date().toISOString(),
  };
  const suspendedAgent = entry.state.pendingAgentCall;
  if (suspendedAgent && entry.waitStartedAt !== undefined)
    entry.waitDurationMs += Math.round(performance.now() - entry.waitStartedAt);
  const answer = new Promise<T>((resolve, reject) => {
    entry.reply = {
      prepare(currentAction, input) {
        const parsed = parseAnswer(currentAction, input);
        return () => {
          if (suspendedAgent) {
            assertCallOwnership(entry, call);
            delete entry.recoveredAnswer;
            entry.state.pendingAgentCall = suspendedAgent;
            entry.state.status = "waiting";
            entry.waitStartedAt = performance.now();
            saveCheckpoint(entry, "waiting");
            notifyRunObservers(entry);
          }
          resolve(parsed);
        };
      },
      reject,
    };
  });
  // Handle rejections from unawaited interaction on failure or stop; the original Promise still rejects.
  void answer.catch(() => {});
  delete entry.state.pendingAgentCall;
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
