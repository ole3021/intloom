import * as z from "zod";
import type { JsonValue, ReadonlyJsonValue, ReadonlyValue } from "./json.ts";
import type { ProjectAccess } from "./project.ts";
import type { StorageAccess } from "./storage.ts";
import { jsonSchemaSchema, type JsonSchema } from "./schema.ts";

export const modelProfileSchema = z.enum(["light", "standard", "deep"]);
export type ModelProfile = z.infer<typeof modelProfileSchema>;
const failureBrand = Symbol.for("intloom.author-failure");
/** An author-declared, safe-to-display failure; never include credentials or raw provider responses. */
export class LoomFailure extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(code))
      throw new Error("Invalid Loom failure code");
    super(message);
    this.name = "LoomFailure";
    this.code = code;
    Object.defineProperty(this, failureBrand, { value: true });
  }
  static is(value: unknown): value is LoomFailure {
    try {
      if (!value || typeof value !== "object") return false;
      const error = value as Record<PropertyKey, unknown>;
      return (
        error[failureBrand] === true &&
        typeof error.code === "string" &&
        /^[A-Z][A-Z0-9_]*$/.test(error.code) &&
        typeof error.message === "string"
      );
    } catch {
      return false;
    }
  }
}
export type LoomInvocationInput =
  | ReadonlyJsonValue
  | import("./inputs.ts").LoomInput;
const name = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
  .refine(
    (value) => !["constructor", "prototype", "__proto__"].includes(value),
  );
export const valueBindingSchema = z.strictObject({
  from: z.union([z.string().min(1), z.array(z.string().min(1)).min(2)]),
  path: z
    .string()
    .regex(/^(?:\/.*)?$/)
    .optional(),
});
export type ValueBinding = z.infer<typeof valueBindingSchema>;
const jsonPointer = z.string().regex(/^(?:\/(?:[^~]|~[01])*)*$/);
export const choicePresentationSchema = z.strictObject({
  itemsPath: jsonPointer,
  valuePath: jsonPointer,
  labelPath: jsonPointer,
  responsePath: jsonPointer.refine((value) => value !== ""),
});
export const appDeclarationSchema = z.strictObject({
  path: z.string().min(1),
  entry: z.string().min(1).default("index.html"),
  type: z.literal("html").default("html"),
});
export const resultPresentationSchema = z.strictObject({
  result: z.strictObject({ app: name }),
});
export const interactionDefinitionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("form"),
    app: name.optional(),
    title: z.string().min(1),
    validate: z.string().min(1).optional(),
    description: z.string().optional(),
    context: jsonSchemaSchema,
    response: jsonSchemaSchema,
  }),
  z.strictObject({
    kind: z.literal("select"),
    app: name.optional(),
    presentation: z
      .strictObject({ choices: choicePresentationSchema })
      .optional(),
    title: z.string().min(1),
    validate: z.string().min(1).optional(),
    description: z.string().optional(),
    context: jsonSchemaSchema,
    response: jsonSchemaSchema,
  }),
  z.strictObject({
    kind: z.literal("confirm"),
    app: name.optional(),
    title: z.string().min(1),
    validate: z.string().min(1).optional(),
    description: z.string().optional(),
    context: jsonSchemaSchema,
  }),
]);
export type InteractionDefinition = z.infer<typeof interactionDefinitionSchema>;
export const confirmationResponseSchema: JsonSchema = {
  type: "object",
  properties: { confirmed: { type: "boolean" } },
  required: ["confirmed"],
  additionalProperties: false,
};
export function interactionResponse(
  definition: InteractionDefinition,
): JsonSchema {
  return definition.kind === "confirm"
    ? confirmationResponseSchema
    : definition.response;
}
export const interactionRequestSchema = z.strictObject({
  interactionId: name,
  definition: interactionDefinitionSchema,
  context: z.json(),
});
export type InteractionRequest = z.infer<typeof interactionRequestSchema>;

export const hostContextSchema = z.strictObject({
  userId: z.string().min(1),
  timeZone: z.string().min(1),
  answerSource: z.enum(["human", "test_simulator"]).default("human"),
  services: z.record(z.string(), z.url()).default({}),
});
export type HostContext = z.infer<typeof hostContextSchema>;
export interface LoomRunContext {
  readonly id: string;
  readonly startedAt: string;
  readonly host: ReadonlyValue<HostContext>;
}
export const interactionReceiptSchema = z.strictObject({
  id: z.string().min(1),
  runId: z.string().min(1),
  request: interactionRequestSchema,
  answer: z.json(),
  acceptedAt: z.string(),
  actor: z.strictObject({
    userId: z.string(),
    source: z.enum(["human", "test_simulator"]),
  }),
});
export type InteractionReceipt = z.infer<typeof interactionReceiptSchema>;
export type InteractionValidator = (
  answer: ReadonlyJsonValue,
  context: ReadonlyJsonValue,
) => { readonly passed: boolean; readonly message?: string };
export type AgentContinuation = (
  saved: {
    readonly request: ReadonlyValue<InteractionRequest>;
    readonly answer: ReadonlyJsonValue;
  },
  input: ReadonlyJsonValue,
  context: LoomContext,
) => JsonValue | Promise<JsonValue>;
export interface LoomContext {
  readonly run: LoomRunContext;
  readonly signal: AbortSignal;
  readonly project?: ProjectAccess;
  readonly storage: StorageAccess;
  readonly interaction: {
    request(id: string, context: ReadonlyJsonValue): Promise<JsonValue>;
    receipt(id: string): ReadonlyValue<InteractionReceipt> | undefined;
    latest(id: string): ReadonlyValue<InteractionReceipt> | undefined;
  };
}
export interface LoomCode<Input = JsonValue, Output = JsonValue> {
  (input: ReadonlyValue<Input>, context: LoomContext): Output | Promise<Output>;
  /** Explicit continuation; the original call is never replayed after a persisted wait. */
  recover?(
    saved: {
      readonly request: ReadonlyValue<InteractionRequest>;
      readonly answer: ReadonlyJsonValue;
    },
    input: ReadonlyValue<Input>,
    context: LoomContext,
  ): Output | Promise<Output>;
}
export function defineCode<Input, Output>(
  code: LoomCode<Input, Output>,
): LoomCode<Input, Output> {
  return code;
}
export const checkResultSchema = z.strictObject({
  passed: z.boolean(),
  message: z.string().optional(),
  details: z.json().optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;
export type AcceptanceCheck = (
  delivery: {
    readonly input: ReadonlyJsonValue;
    readonly output: ReadonlyJsonValue;
  },
  context: LoomContext,
) => CheckResult | Promise<CheckResult>;

export const agentDeclarationSchema = z.strictObject({
  definition: z.string().min(1),
  resume: z.string().min(1).optional(),
  modelProfile: modelProfileSchema,
  input: jsonSchemaSchema.optional(),
  output: jsonSchemaSchema.optional(),
  interactions: z.array(name).default([]),
  skills: z.array(z.string().min(1)).default([]),
  tools: z.array(z.string().min(1)).default([]),
});
export const executeDeclarationSchema = z.union([
  z.strictObject({ code: z.string().min(1) }),
  z.strictObject({ agent: name }),
  z.strictObject({ workflow: z.string().min(1) }),
]);
export const acceptanceDeclarationSchema = z.strictObject({
  checks: z
    .array(
      z.strictObject({
        id: name,
        description: z.string().optional(),
        code: z.string().min(1),
      }),
    )
    .default([]),
  confirmation: name.optional(),
});
export const loomDefinitionSchema = z.strictObject({
  schemaVersion: z.literal("1").default("1"),
  name: z
    .string()
    .min(1)
    .refine(
      (value) => !["constructor", "prototype", "__proto__"].includes(value),
    ),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  description: z.string().default(""),
  input: jsonSchemaSchema,
  output: jsonSchemaSchema,
  execute: executeDeclarationSchema,
  agents: z.record(name, agentDeclarationSchema).default({}),
  apps: z.record(name, appDeclarationSchema).optional(),
  presentation: resultPresentationSchema.optional(),
  interactions: z.record(name, interactionDefinitionSchema).default({}),
  acceptance: acceptanceDeclarationSchema.optional(),
});
export type LoomDefinition = z.infer<typeof loomDefinitionSchema>;
export const workflowDefinitionSchema = z.strictObject({
  steps: z
    .array(
      z.strictObject({
        id: name,
        execute: z.union([
          z.strictObject({ code: z.string().min(1) }),
          z.strictObject({ agent: name }),
        ]),
        input: valueBindingSchema.default({ from: "input" }),
        when: z
          .strictObject({ value: valueBindingSchema, equals: z.json() })
          .optional(),
      }),
    )
    .min(1),
  output: valueBindingSchema,
});
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
