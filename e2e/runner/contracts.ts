import * as z from "zod";

export const entrySchema = z.enum(["cmd", "mcp", "codex"]);
export type Entry = z.infer<typeof entrySchema>;
export type ResultStatus = "passed" | "failed" | "blocked" | "interrupted";
export type FailureCategory =
  | "system"
  | "model"
  | "scenario"
  | "environment"
  | "runner"
  | "client"
  | "unknown";
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
export const caseSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  version: z.number().int().positive().default(1),
  name: z.string().min(1).default("Workflow iteration case"),
  scale: z.string().optional(),
  description: z.string().default(""),
  intents: z
    .array(
      z
        .string()
        .refine((value) => Boolean(value.trim()), "Intent must be nonempty."),
    )
    .min(1),
  models: z.record(z.string(), z.json()).optional(),
});
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
  commandTimeoutMs: z.number().int().positive().max(2147483647).optional(),
  modelConnectionTimeoutMs: z
    .number()
    .int()
    .positive()
    .max(2147483647)
    .optional(),
  modelConnectionRetries: z.number().int().min(0).max(2).optional(),
  modelIdleTimeoutMs: z.number().int().positive().max(2147483647).optional(),
});
export const profileSchema = z.strictObject({
  user: modelSchema,
  clientAgent: modelSchema.optional(),
  service: z.record(z.string(), modelSchema).optional(),
  mcpExecutor: z.enum(["mcp_client", "service"]).default("mcp_client"),
  storage: z.enum(["file", "sqlite"]).default("file"),
  limits: limitsSchema.default({}),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProjectProfile = Omit<Profile, "user"> & { user?: ModelConfig };
export const codexProfileSchema = z.strictObject({
  storage: profileSchema.shape.storage,
  limits: profileSchema.shape.limits,
});
export interface Options {
  entry: Entry;
  root: string;
  suite: string;
  casesRoot: string;
  profile?: string;
  cli: string;
  workflow: string;
  flowName?: string;
  workspacePackage?: string;
  workspaceWorkflow?: boolean;
  caseId?: string;
  seed: string;
  codex?: string;
  codexModel?: string;
}
export interface Check {
  id: string;
  status: "passed" | "failed" | "not_run";
  message: string;
  evidence?: string;
}
export const runSchema = z
  .object({
    runId: z.string(),
    flowName: z.string(),
    status: z.enum(["running", "waiting", "paused", "completed", "failed"]),
    execution: z.object({ source: z.string(), agentExecutor: z.string() }),
    cursor: z.object({ stageName: z.string(), stepName: z.string() }),
    pendingAction: z
      .object({ id: z.string(), kind: z.string(), request: z.json() })
      .optional(),
    pendingAgentCall: z.object({ id: z.string() }).optional(),
    results: z
      .array(
        z.object({
          kind: z.string(),
          id: z.string(),
          stageName: z.string(),
          revision: z.number().optional(),
        }),
      )
      .optional(),
    settled: z.boolean().optional(),
    control: z
      .object({
        traceId: z.string(),
        stepVisitId: z.number().int().nonnegative().optional(),
        captureDisabled: z.boolean().optional(),
        pauseReason: z.string().optional(),
        pauseCause: z.string().optional(),
      })
      .optional(),
    lastError: z.object({ code: z.string(), message: z.string() }).optional(),
  })
  .passthrough();
export type Run = z.infer<typeof runSchema>;
export interface Findings {
  checks: Check[];
  run: Run | null;
  mirrorIds: string[];
  coverage: Record<string, unknown>;
}
