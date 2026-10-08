import * as z from "zod";
import { nonEmptyStringSchema } from "./common.ts";

export const LlmKind = {
  Reasoning: "reasoning",
  Coding: "coding",
  Review: "review",
} as const;
export type LlmKind = (typeof LlmKind)[keyof typeof LlmKind];

export const llmConfigSchema = z.strictObject({
  provider: z.enum(["anthropic", "openai-compatible"]),
  model: nonEmptyStringSchema,
  secret: z.string().regex(/^(?:DENV|ENV)\.[A-Z_][A-Z0-9_]*$/),
  baseURL: z.url().optional(),
  // common parameters
  parameters: z
    .object({
      temperature: z.number().optional(),
      maxOutputTokens: z.number().int().positive().optional(),
      topP: z.number().optional(),
    })
    .optional(),
  // provider specific options
  providerOptions: z.record(z.string(), z.json()).optional(),
});
