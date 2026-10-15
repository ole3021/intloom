import type * as z from "zod";
import type { questionSchema, BaseState } from "./schema/common.ts";
import { userAnswerQuestionsSchema } from "@intloom/loom-sdk";
import { fail } from "./errors.ts";
import { unique } from "./state.ts";
export function unanswered(
  state: BaseState,
  questions: z.infer<typeof questionSchema>[],
) {
  unique(
    questions.map((q) => q.key),
    "question keys",
  );
  return questions.filter(
    (question) =>
      !state.interactions.some((interaction) => {
        if (
          interaction.kind !== "questions" ||
          !Array.isArray(interaction.request)
        )
          return false;
        const old = interaction.request.find(
          (q) =>
            q &&
            typeof q === "object" &&
            !Array.isArray(q) &&
            q.id === question.key,
        );
        if (!old || typeof old !== "object" || Array.isArray(old)) return false;
        if (old.question !== question.question)
          fail("A question key cannot be reused with different wording.");
        return userAnswerQuestionsSchema
          .parse(interaction.answer)
          .some(
            (answer) => answer.questionId === question.key && !answer.isSkipped,
          );
      }),
  );
}
