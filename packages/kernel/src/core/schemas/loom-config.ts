import * as z from "zod";
import { intentConfigSchema } from "./intent-config.ts";
import { LlmKind, llmConfigSchema } from "./llm-config.ts";

export const workflowDependencySchema = z.strictObject({
  name: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  // Local archives must remain accessible when rebuilding the installation.
  source: z.string().min(1).optional(),
});
export const workflowDependenciesSchema = z
  .array(workflowDependencySchema)
  .refine(
    (items) => new Set(items.map((item) => item.name)).size === items.length,
    "Workflow package names must be unique",
  );
export type WorkflowDependency = z.infer<typeof workflowDependencySchema>;

export const loomConfigSchema = z.strictObject({
  workflows: workflowDependenciesSchema.optional(),
  localStorage: z.enum(["file", "sqlite"]).optional(),
  // workflow specific configs
  intent: intentConfigSchema,
  useMcpAgent: z.boolean().default(true),
  // Service execution validates credentials before creating a Run.
  llms: z
    .intersection(
      z.object({
        default: llmConfigSchema,
      }),
      z.partialRecord(z.enum(LlmKind), llmConfigSchema),
    )
    .optional(),
});

export type LoomConfig = z.infer<typeof loomConfigSchema>;
