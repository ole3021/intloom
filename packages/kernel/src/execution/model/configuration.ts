import * as z from "zod";
const nonEmptyStringSchema = z.string().trim().min(1);

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

export type ModelConfig = z.infer<typeof llmConfigSchema>;
export interface ModelConfiguration {
  readonly models?:
    | Partial<
        Record<
          import("@intloom/loom-sdk").ModelProfile,
          ModelConfig | undefined
        >
      >
    | undefined;
  readonly llms?:
    | ({ readonly default: ModelConfig } & Partial<
        Record<
          import("@intloom/loom-sdk").AgentModelType,
          ModelConfig | undefined
        >
      >)
    | undefined;
}
