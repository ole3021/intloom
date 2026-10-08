import * as z from "zod";
import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  userAnswerQuestionsSchema,
  userAnswerConfirmationSchema,
  type PendingUserAction,
  type ReadonlyJsonValue,
} from "@intloom/kernel";
import { failure } from "../errors.ts";

export interface ActionForm {
  readonly message: string;
  readonly schema: z.ZodObject<Record<string, z.ZodType>>;
  decode(input: unknown): ReadonlyJsonValue;
}

/** MCP forms contain flat primitive fields; this layer converts arrays and option IDs without changing Kernel contracts. */
export function actionForm(action: PendingUserAction): ActionForm {
  if (action.kind === "user_ask_confirmation") {
    const request = userAskConfirmationSchema.parse(action.request);
    const schema = z.strictObject({
      decision: z
        .enum(["confirm", "revise"])
        .meta({ title: "Confirm / Request changes" }),
      feedback: z.string().optional().meta({
        title: "Revision feedback",
        description:
          "Fill in when requesting changes; original text is preserved.",
      }),
    });
    return {
      message: request.context,
      schema,
      decode(input) {
        const value = schema.parse(input);
        const answer = userAnswerConfirmationSchema.parse({
          isConfirmed: value.decision === "confirm",
          ...(value.feedback === undefined ? {} : { feedback: value.feedback }),
        });
        return {
          isConfirmed: answer.isConfirmed,
          ...(answer.feedback === undefined
            ? {}
            : { feedback: answer.feedback }),
        };
      },
    };
  }
  const questions = userAskQuestionsSchema.parse(action.request);
  const fields: Record<string, z.ZodType> = {};
  for (const [index, question] of questions.entries()) {
    const key = `q${index}`;
    if (question.options?.length) {
      const choices = question.options.map((_, option) => `option_${option}`);
      choices.push("custom");
      if (question.isSkippable) choices.push("skip");
      fields[`${key}_choice`] = z.enum(choices).meta({
        title: question.question,
        description: [
          ...question.options.map(
            (option, i) =>
              `option_${i}: ${option.label}${option.description ? ` — ${option.description}` : ""}`,
          ),
          "custom: Enter your own answer",
          ...(question.isSkippable ? ["skip: Skip for now"] : []),
        ].join("\n"),
      });
      fields[`${key}_answer`] = z
        .string()
        .optional()
        .meta({ title: `${question.question} · Custom answer` });
    } else {
      fields[`${key}_answer`] = (
        question.isSkippable ? z.string().optional() : z.string().min(1)
      ).meta({
        title: question.question,
        ...(question.description ? { description: question.description } : {}),
      });
      if (question.isSkippable)
        fields[`${key}_skip`] = z
          .boolean()
          .optional()
          .meta({ title: `${question.question} · Skip` });
    }
  }
  const schema = z.strictObject(fields);
  return {
    message:
      "Answer the Workflow questions. Only skippable questions may be left unanswered.",
    schema,
    decode(input) {
      const value = schema.parse(input);
      return userAnswerQuestionsSchema.parse(
        questions.map((question, index) => {
          const key = `q${index}`;
          const choice = value[`${key}_choice`];
          const skipped = choice === "skip" || value[`${key}_skip`] === true;
          if (skipped) {
            if (!question.isSkippable)
              throw failure(
                "INVALID_REQUEST",
                "This question cannot be skipped.",
              );
            return { questionId: question.id, isSkipped: true };
          }
          const option =
            typeof choice === "string" && choice.startsWith("option_")
              ? question.options?.[Number(choice.slice(7))]
              : undefined;
          return {
            questionId: question.id,
            isSkipped: false,
            answer: option?.label ?? value[`${key}_answer`],
          };
        }),
      );
    },
  };
}
