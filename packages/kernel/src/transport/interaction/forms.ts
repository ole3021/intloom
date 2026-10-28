import * as z from "zod";
import {
  interactionChoices,
  choiceAnswer,
} from "@intloom/loom-sdk/app-contracts";
import {
  interactionRequestSchema,
  interactionResponse,
  parseSchemaValue,
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  userAnswerQuestionsSchema,
  userAnswerConfirmationSchema,
} from "@intloom/loom-sdk";
import type { PendingUserAction } from "../../runtime/run-view.ts";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import { failure } from "../../errors.ts";

export interface ActionForm {
  readonly message: string;
  readonly schema: z.ZodObject<Record<string, z.ZodType>>;
  decode(input: unknown): ReadonlyJsonValue;
}

/** MCP forms contain flat primitive fields; this layer converts arrays and option IDs without changing Kernel contracts. */
export function actionForm(action: PendingUserAction): ActionForm {
  if (action.kind === "user_ask_interaction") {
    const request = interactionRequestSchema.parse(action.request);
    const response = interactionResponse(request.definition);
    const message = `${request.definition.title}\n${request.definition.description ?? ""}\nContext: ${JSON.stringify(request.context)}\nResponse schema: ${JSON.stringify(response)}`;
    if (request.definition.kind === "confirm") {
      const schema = z.strictObject({
        confirmed: z.boolean().meta({ title: request.definition.title }),
      });
      return { message, schema, decode: (input) => schema.parse(input) };
    }
    if (
      request.definition.kind === "select" &&
      request.definition.presentation
    ) {
      try {
        const mapping = request.definition.presentation.choices;
        const choices = interactionChoices(request.context, mapping);
        if (choices.length) {
          const schema = z.strictObject({
            choice: z.enum(choices.map((_, index) => `option_${index}`)).meta({
              title: request.definition.title,
              description: choices
                .map((item, index) => `option_${index}: ${item.label}`)
                .join("\n"),
            }),
          });
          return {
            message,
            schema,
            decode(input) {
              const index = Number(schema.parse(input).choice.slice(7));
              const item = choices[index];
              if (!item) throw failure("INVALID_REQUEST", "Unknown choice");
              return parseSchemaValue(
                response,
                choiceAnswer(mapping.responsePath, item.value),
              );
            },
          };
        }
      } catch {
        /* An unusable display projection falls back to the complete schema/context. */
      }
    }
    if (
      response &&
      typeof response === "object" &&
      response.type === "object" &&
      response.properties &&
      typeof response.properties === "object" &&
      !Array.isArray(response.properties)
    ) {
      const fields: Record<string, z.ZodType> = {};
      let flat = response.additionalProperties === false;
      for (const [key, field] of Object.entries(response.properties)) {
        if (
          !field ||
          typeof field !== "object" ||
          Array.isArray(field) ||
          !["string", "number", "integer", "boolean"].includes(
            String(field.type),
          )
        ) {
          flat = false;
          break;
        }
        let schema: z.ZodType =
          field.type === "boolean"
            ? z.boolean()
            : field.type === "string"
              ? z.string()
              : field.type === "integer"
                ? z.number().int()
                : z.number();
        if (
          Array.isArray(field.enum) &&
          field.enum.every((value) => typeof value === "string")
        )
          schema = z.enum(field.enum as string[]);
        if (
          !Array.isArray(response.required) ||
          !response.required.includes(key)
        )
          schema = schema.optional();
        fields[key] = schema.meta({
          title: typeof field.title === "string" ? field.title : key,
          ...(typeof field.description === "string"
            ? { description: field.description }
            : {}),
        });
      }
      if (flat)
        return {
          message,
          schema: z.strictObject(fields),
          decode: (input) => parseSchemaValue(response, input),
        };
    }
    const schema = z.strictObject({
      json: z.string().meta({
        title: request.definition.title,
        description:
          "Enter a JSON value matching the declared response schema.",
      }),
    });
    return {
      message,
      schema,
      decode: (input) =>
        parseSchemaValue(response, JSON.parse(schema.parse(input).json)),
    };
  }
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
      "Answer the Loom questions. Only skippable questions may be left unanswered.",
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
