import * as z from "zod";
import {
  userAnswerConfirmationSchema,
  userAnswerQuestionsSchema,
  userAskQuestionsSchema,
  type CodeRecovery,
} from "@intloom/loom-sdk";
import type { StageCodeAccess } from "./access.ts";
import type { BaseState } from "./schema/common.ts";
import { digest, json } from "./json.ts";
import { save } from "./state.ts";
import { fail } from "./errors.ts";
import { evidence, rawState } from "./project.ts";
const questionRequest = userAskQuestionsSchema;
export async function interact<S extends BaseState>(
  access: StageCodeAccess,
  state: S,
  kind: "questions" | "confirmation",
  purpose: string,
  request: unknown,
  recovery?: CodeRecovery,
) {
  const requestValue = json(request),
    reviewDigest = digest({ request: requestValue, purpose });
  let pending = state.pendingInteraction;
  if (
    pending &&
    (pending.reviewDigest !== reviewDigest ||
      pending.revision !== state.revision ||
      pending.kind !== kind)
  )
    fail(
      "Saved interaction no longer matches the current review.",
      "STALE_INTENT_REPLY",
    );
  if (!pending) {
    if (recovery) fail("Missing saved interaction.", "STALE_INTENT_REPLY");
    pending = {
      id: `USR-${digest({ runId: state.id, stage: state.stageName, purpose, revision: state.revision, reviewDigest }).slice(0, 24)}`,
      kind,
      purpose,
      request: requestValue,
      revision: state.revision,
      reviewDigest,
    };
    state.pendingInteraction = pending;
    await save(access, state, false);
  }
  if (
    recovery &&
    (recovery.kind !==
      (kind === "questions" ? "user_ask_questions" : "user_ask_confirmation") ||
      digest(recovery.request) !== digest(requestValue))
  )
    fail(
      "Recovered reply belongs to a different request.",
      "STALE_INTENT_REPLY",
    );
  const raw = recovery
    ? recovery.answer
    : kind === "confirmation"
      ? await access.interaction.confirm(
          z.object({ context: z.string() }).parse(request).context,
        )
      : await access.interaction.askQuestions(questionRequest.parse(request));
  const answer =
    kind === "confirmation"
      ? userAnswerConfirmationSchema.parse(raw)
      : userAnswerQuestionsSchema.parse(raw);
  if (rawState(access).revision !== state.revision)
    fail("State changed while awaiting the user.", "STALE_INTENT_REPLY");
  if (kind === "questions") {
    const questions = questionRequest.parse(request),
      replies = userAnswerQuestionsSchema.parse(answer);
    if (
      replies.length !== questions.length ||
      new Set(replies.map((item) => item.questionId)).size !==
        questions.length ||
      replies.some(
        (item) =>
          !questions.some((q) => q.id === item.questionId) || item.isSkipped,
      )
    )
      fail("Every required question needs its actual answer.");
  }
  const receipt = {
    id: pending.id,
    kind,
    purpose,
    request: requestValue,
    answer: json(answer),
    at: new Date().toISOString(),
  };
  state.interactions.push(receipt);
  const candidate = "candidate" in state ? state.candidate : undefined;
  evidence(
    state,
    "user_report",
    receipt,
    candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string"
      ? candidate.id
      : undefined,
  );
  delete state.pendingInteraction;
  await save(access, state, false);
  return receipt;
}
export async function answerQuestions<S extends BaseState>(
  access: StageCodeAccess,
  state: S,
  recovery?: CodeRecovery,
) {
  if (!state.questions.length) fail("No unresolved questions.");
  const receipt = await interact(
    access,
    state,
    "questions",
    "clarification",
    state.questions.map((q) => ({
      id: q.key,
      question: q.question,
      isSkippable: false,
    })),
    recovery,
  );
  state.questions = [];
  return receipt;
}
export function approved(answer: unknown) {
  const value = userAnswerConfirmationSchema.parse(answer);
  return value.isConfirmed && !value.feedback?.trim();
}
export function feedback(answer: unknown) {
  const value = userAnswerConfirmationSchema.parse(answer);
  return (
    value.feedback?.trim() ||
    "The user did not approve this proposal. Revise or ask what needs to change."
  );
}
