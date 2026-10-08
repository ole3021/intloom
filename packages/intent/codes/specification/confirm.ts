import type { CodeRecovery, ReadonlyJsonValue } from "@intloom/workflow-sdk";
import { isDeepStrictEqual } from "node:util";
import {
  confirmationAnswerSchema,
  answersSchema,
  interaction,
  type IntentCodeAccess,
} from "../../src/specification/interaction.ts";
import { fail } from "../../src/specification/errors.ts";
import {
  readInitializedState,
  saveState,
} from "../../src/specification/state.ts";
import type { SpecificationState } from "../../schemas/specification-state.ts";
import { assertBaseline } from "../../src/specification/baseline.ts";
import { confirmationContext } from "../../src/specification/confirmation.ts";
import { review } from "../../src/specification/review.ts";
import { formatConfirmation } from "../../src/specification/format-confirmation.ts";

async function confirm(_input: ReadonlyJsonValue, access: IntentCodeAccess) {
  const { state, message } = await prepareConfirmation(access);
  const answer = await interaction(access).confirm(message);
  return finishConfirmation(access, state, message, answer);
}

confirm.recover = async (saved: CodeRecovery, access: IntentCodeAccess) => {
  const { state, message } = await prepareConfirmation(access);
  if (saved.action.kind === "user_ask_confirmation")
    return finishConfirmation(access, state, message, saved.answer);
  const replies = answersSchema.parse(saved.answer);
  const reply = replies[0];
  if (
    replies.length !== 1 ||
    reply?.questionId !== "confirmation_feedback" ||
    reply.isSkipped
  )
    fail("Saved confirmation feedback must contain its required answer");
  return finishConfirmation(access, state, message, {
    isConfirmed: false,
    feedback: reply.answer,
  });
};

async function prepareConfirmation(access: IntentCodeAccess) {
  const state = readInitializedState(access);
  const { artifact } = review(state);
  if (
    !state.confirmation ||
    state.confirmation.confirmed ||
    !isDeepStrictEqual(state.confirmation.context, confirmationContext(state))
  )
    fail("Check must prepare a fresh confirmation snapshot");
  await assertBaseline(access, state);
  const message = formatConfirmation(artifact);
  return { state, message };
}

async function finishConfirmation(
  access: IntentCodeAccess,
  state: SpecificationState,
  message: string,
  input: unknown,
) {
  if (!state.confirmation)
    fail("Check must prepare a fresh confirmation snapshot");
  let answer = confirmationAnswerSchema.parse(input);
  await assertFresh(access, state);
  // An affirmative answer with revision feedback cannot authorize submission; request explicit confirmation within the same Code call.
  while (answer.isConfirmed && answer.feedback?.trim()) {
    answer = confirmationAnswerSchema.parse(
      await interaction(access).confirm(
        `${message}\n\nThe previous confirmation also included revision feedback: ${answer.feedback}\nTo request changes, decline and provide feedback. To save, confirm explicitly without revision feedback.`,
      ),
    );
    await assertFresh(access, state);
  }
  if (answer.isConfirmed) {
    if (!state.confirmation)
      fail("Check must prepare a fresh confirmation snapshot");
    state.confirmation.confirmed = true;
  } else {
    let feedback = answer.feedback;
    if (!feedback?.trim()) {
      const replies = answersSchema.parse(
        await interaction(access).askQuestions([
          {
            id: "confirmation_feedback",
            question: "Describe the changes you need.",
            isSkippable: false,
          },
        ]),
      );
      await assertFresh(access, state);
      const reply = replies[0];
      if (
        replies.length !== 1 ||
        reply?.questionId !== "confirmation_feedback" ||
        reply.isSkipped
      )
        fail("Confirmation feedback must answer its required question once");
      feedback = reply.answer;
    }
    state.feedbacks.push({ source: "user", content: feedback });
    delete state.confirmation;
  }
  await saveState(access, state);
  return { outcome: answer.isConfirmed ? "confirmed" : "feedback" };
}
export default confirm;

async function assertFresh(
  access: IntentCodeAccess,
  state: SpecificationState,
) {
  if (!isDeepStrictEqual(readInitializedState(access), state))
    fail(
      "State changed while waiting for confirmation",
      "STALE_SPECIFICATION_REPLY",
    );
  await assertBaseline(access, state);
}
