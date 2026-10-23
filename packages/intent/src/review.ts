import {
  userAnswerQuestionsSchema,
  userAskQuestionsSchema,
} from "@intloom/loom-sdk";
import type { BaseState, Candidate, Evidence } from "./schema/common.ts";
import type { VerificationEntry } from "./schema/verification.ts";
import { executionDataSchema } from "./schema/verification.ts";

export const bullets = (values: string[]) =>
  values.length ? values.map((value) => `- ${value}`).join("\n") : "None.";
export const section = (title: string, content: string) =>
  `## ${title}\n\n${content}`;
export function answers(state: BaseState) {
  return state.interactions
    .filter((receipt) => receipt.kind === "questions")
    .flatMap((receipt) => {
      const questions = userAskQuestionsSchema.parse(receipt.request),
        replies = userAnswerQuestionsSchema.parse(receipt.answer);
      return replies.map(
        (reply) =>
          `${questions.find((question) => question.id === reply.questionId)?.question ?? reply.questionId}\n  Answer: ${reply.isSkipped ? "Skipped" : reply.answer}`,
      );
    });
}
export function candidateLabel(value: Candidate) {
  return value.id;
}
export function verificationLines(
  entries: VerificationEntry[],
  evidence: Evidence[],
) {
  return entries.map((entry) => {
    const receipt = entry.evidenceRefs
      .map((ref) => evidence.find((item) => item.id === ref))
      .filter(Boolean)
      .at(-1);
    const execution = executionDataSchema.safeParse(receipt?.data);
    return `${entry.definition.purpose}: ${entry.disposition}; attempts: ${entry.attempts}. ${entry.reason}${execution.success ? ` Exit: ${execution.data.result.exitCode ?? "unknown"}; timed out: ${execution.data.result.timedOut}; truncated: ${execution.data.result.truncated}.` : ""}`;
  });
}
