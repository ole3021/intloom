import * as z from "zod";
import { loomInputSchema } from "@intloom/loom-sdk";
import { runViewSchema } from "@intloom/kernel/host";

export const entrySchema = z.enum(["cmd", "mcp"]);
export type Entry = z.infer<typeof entrySchema>;
export type ResultStatus = "passed" | "failed" | "blocked" | "interrupted";
export type FailureCategory =
  | "system"
  | "model"
  | "scenario"
  | "environment"
  | "runner";
export class E2eError extends Error {
  readonly code: string;
  readonly category: FailureCategory;
  readonly status: ResultStatus;
  constructor(
    code: string,
    message: string,
    category: FailureCategory,
    status: ResultStatus = "failed",
  ) {
    super(message);
    this.code = code;
    this.category = category;
    this.status = status;
  }
}
export const runSchema = runViewSchema;
export type Run = z.infer<typeof runSchema>;
export const caseSchema = z
  .strictObject({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    version: z.number().int().positive().default(1),
    name: z.string().min(1),
    description: z.string().default(""),
    rounds: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
          input: loomInputSchema,
          knowledge: z.string().min(1).optional(),
        }),
      )
      .min(1),
  })
  .refine(
    (c) => new Set(c.rounds.map((r) => r.id)).size === c.rounds.length,
    "Round IDs must be unique",
  );
export type CaseManifest = z.infer<typeof caseSchema>;
export const modelSchema = z.strictObject({
  provider: z.enum(["openai-compatible", "anthropic"]),
  model: z.string().min(1),
  secret: z.string().regex(/^ENV\.[A-Z_][A-Z0-9_]*$/),
  baseURL: z.string().min(1).optional(),
  parameters: z
    .strictObject({
      temperature: z.number().optional(),
      maxOutputTokens: z.number().int().positive().optional(),
      topP: z.number().optional(),
    })
    .optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.json()))
    .optional(),
});
export type ModelConfig = z.infer<typeof modelSchema>;
export const limitsSchema = z.strictObject({
  maxDurationMs: z.number().int().positive().max(2147483647).optional(),
  maxUserSteps: z.number().int().positive().optional(),
  maxAgentSteps: z.number().int().positive().optional(),
  commandTimeoutMs: z.number().int().positive().max(2147483647).default(120000),
  modelConnectionTimeoutMs: z
    .number()
    .int()
    .positive()
    .max(2147483647)
    .default(60000),
  modelConnectionRetries: z.number().int().min(0).max(3).default(3),
  modelIdleTimeoutMs: z.number().int().positive().max(2147483647).optional(),
});
export const modelsSchema = z.strictObject({
  user: modelSchema,
  worker: modelSchema.optional(),
  service: z
    .strictObject({
      default: modelSchema,
      thinking: modelSchema.optional(),
      working: modelSchema.optional(),
      coding: modelSchema.optional(),
    })
    .optional(),
});
export const configurationSchema = z.strictObject({
  version: z.literal(1),
  models: modelsSchema.optional(),
  storage: z.enum(["file", "sqlite"]).default("file"),
  limits: limitsSchema.prefault({}),
  preparation: z.array(z.string().min(1)).default([]),
  checks: z.array(z.string().min(1)).default([]),
});
export type Configuration = z.infer<typeof configurationSchema>;
export type Models = z.infer<typeof modelsSchema>;
export interface Options {
  packagePath: string;
  root: string;
  entry: Entry;
  caseId?: string;
  seed: string;
  profile?: string;
  cli: string;
}
export interface Results {
  artifacts: unknown[];
  records: unknown[];
}
