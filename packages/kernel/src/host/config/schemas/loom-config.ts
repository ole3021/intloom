import * as z from "zod";

import { llmConfigSchema } from "../../../execution/model/configuration.ts";

export const loomDependencySchema = z.strictObject({
  name: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  // Local archives must remain accessible when rebuilding the installation.
  source: z.string().min(1).optional(),
});
export const loomDependenciesSchema = z
  .array(loomDependencySchema)
  .refine(
    (items) => new Set(items.map((item) => item.name)).size === items.length,
    "Loom package names must be unique",
  );
export type LoomDependency = z.infer<typeof loomDependencySchema>;

export const loomConfigSchema = z.strictObject({
  looms: loomDependenciesSchema.optional(),
  mirror: z
    .strictObject({
      enabled: z.boolean().default(false),
      files: z
        .strictObject({
          include: z.array(z.string().min(1)).default([]),
          exclude: z.array(z.string().min(1)).default([]),
        })
        .optional(),
    })
    .optional(),
  localStorage: z.enum(["file", "sqlite"]).optional(),
  useMcpAgent: z.boolean().default(true),
  // Service execution validates credentials before creating a Run.
  llms: z
    .strictObject({
      default: llmConfigSchema,
      thinking: llmConfigSchema.optional(),
      working: llmConfigSchema.optional(),
      coding: llmConfigSchema.optional(),
    })
    .optional(),
});

export type LoomConfig = z.infer<typeof loomConfigSchema>;
