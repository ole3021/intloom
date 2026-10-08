import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
} from "@intloom/kernel";
import type { ActionPresenter } from "../interaction/contracts.ts";
import type { TerminalUi, Choice } from "./terminal.ts";

export function terminalPresenter(ui: TerminalUi): ActionPresenter {
  return {
    async present(action) {
      if (!ui.interactive) return { kind: "unavailable" };
      if (action.kind === "user_ask_confirmation") {
        const request = userAskConfirmationSchema.parse(action.request);
        ui.note(request.context);
        const decision = await ui.choose("Do you confirm the content above?", [
          { value: "confirm", label: "Confirm" },
          { value: "revise", label: "Request changes" },
        ]);
        if (decision === undefined) return { kind: "dismissed" };
        if (decision === "confirm")
          return { kind: "answered", answer: { isConfirmed: true } };
        const feedback = await ui.text(
          "Enter revision feedback (optional)",
          false,
        );
        if (feedback === undefined) return { kind: "dismissed" };
        return { kind: "answered", answer: { isConfirmed: false, feedback } };
      }
      const questions = userAskQuestionsSchema.parse(action.request);
      const answers = [];
      for (const question of questions) {
        if (question.description) ui.note(question.description);
        const choices: Choice[] = (question.options ?? []).map(
          (option, index) => ({
            value: `option_${index}`,
            label: option.label,
            ...(option.description ? { hint: option.description } : {}),
          }),
        );
        choices.push({ value: "custom", label: "Enter an answer" });
        if (question.isSkippable)
          choices.push({ value: "skip", label: "Skip for now" });
        const choice =
          choices.length > 1
            ? await ui.choose(question.question, choices)
            : "custom";
        if (choice === undefined) return { kind: "dismissed" };
        if (choice === "skip") {
          answers.push({ questionId: question.id, isSkipped: true });
          continue;
        }
        const answer =
          choice === "custom"
            ? await ui.text(question.question, true)
            : question.options?.[Number(choice.slice(7))]?.label;
        if (answer === undefined) return { kind: "dismissed" };
        answers.push({ questionId: question.id, isSkipped: false, answer });
      }
      return { kind: "answered", answer: answers };
    },
  };
}
