import { z } from "zod";

export const selectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("option"), value: z.string().min(1) }),
  z.strictObject({ kind: z.literal("custom"), text: z.string().trim().min(1) }),
]);
export type Selection = z.infer<typeof selectionSchema>;
export const answerJsonSchema = z.record(z.string(), z.json());
export type AnswerJsonSchema = z.infer<typeof answerJsonSchema>;

const common = {
  question: z
    .string()
    .refine((text) => Boolean(text.trim()), "A question is required"),
  context: z.string().optional(),
  allowSkip: z.boolean().optional(),
  allowDefer: z.boolean().optional(),
};
const choices = {
  options: z
    .array(
      z.strictObject({ value: z.string().min(1), label: z.string().min(1) }),
    )
    .min(1)
    .readonly(),
  allowCustom: z.boolean().optional(),
};
function requestSchema<S extends z.ZodType>(schema: S) {
  const fields = { ...common, schema: schema.optional() };
  return z
    .discriminatedUnion("mode", [
      z.strictObject({ ...fields, mode: z.literal("text") }),
      z.strictObject({ ...fields, mode: z.literal("confirm") }),
      z.strictObject({ ...fields, ...choices, mode: z.literal("single") }),
      z.strictObject({ ...fields, ...choices, mode: z.literal("multiple") }),
    ])
    .superRefine((request, context) => {
      if (
        "options" in request &&
        new Set(request.options.map((option) => option.value)).size !==
          request.options.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Option values must be unique",
        });
      }
    });
}

export const askInputSchema = requestSchema(answerJsonSchema);
export const askRequestSchema = requestSchema(
  z.union([z.instanceof(z.ZodType), answerJsonSchema]),
);
export type AskInput = z.infer<typeof askInputSchema>;
export type AskRequest = z.infer<typeof askRequestSchema>;

type ModeAnswer<Q> = Q extends { mode: "text" }
  ? string
  : Q extends { mode: "confirm" }
    ? boolean
    : Q extends { mode: "single" }
      ? Selection
      : readonly Selection[];
export type AskAnswer<Q> = Q extends { schema: z.ZodType<infer T> }
  ? T
  : ModeAnswer<Q>;
export type AskResult<Q> =
  | { readonly status: "answered"; readonly value: AskAnswer<Q> }
  | (Q extends { allowSkip?: infer S }
      ? true extends S
        ? { readonly status: "skipped" }
        : never
      : never);
type CheckedQuestion<Q extends AskRequest> =
  AskAnswer<Q> extends ModeAnswer<Q>
    ? Record<
        Exclude<keyof Q, keyof Extract<AskRequest, { mode: Q["mode"] }>>,
        never
      >
    : never;

export interface UserTools {
  ask<const Q extends AskRequest>(
    request: Q & CheckedQuestion<Q>,
  ): Promise<AskResult<Q>>;
}

export const askSubmissionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("answered"), value: z.json() }),
  z.strictObject({ status: z.literal("skipped") }),
  z.strictObject({ status: z.literal("deferred") }),
]);
export type AskSubmission = z.infer<typeof askSubmissionSchema>;

export function createAnswerSchema(request: AskRequest): z.ZodType {
  const selection = selectionSchema.superRefine((answer, context) => {
    if (!("options" in request)) return;
    if (
      answer.kind === "custom"
        ? !request.allowCustom
        : !request.options.some((option) => option.value === answer.value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a listed option or an allowed custom answer",
      });
    }
  });
  const base: z.ZodType =
    request.mode === "text"
      ? z.string()
      : request.mode === "confirm"
        ? z.boolean()
        : request.mode === "single"
          ? selection
          : z
              .array(selection)
              .min(1)
              .superRefine((answers, context) => {
                const keys = answers.map((answer) => JSON.stringify(answer));
                if (new Set(keys).size !== keys.length)
                  context.addIssue({
                    code: "custom",
                    message: "Selections must not repeat",
                  });
              });
  const schema =
    request.schema instanceof z.ZodType
      ? request.schema
      : request.schema
        ? z.fromJSONSchema(request.schema)
        : undefined;
  return schema ? base.pipe(schema).pipe(base) : base;
}

export function describeQuestion(request: AskRequest): AskInput {
  const { schema, ...question } = request;
  return {
    ...question,
    ...(schema
      ? {
          schema:
            schema instanceof z.ZodType
              ? answerJsonSchema.parse(z.toJSONSchema(schema, { io: "input" }))
              : schema,
        }
      : {}),
  };
}
