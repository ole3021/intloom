import * as z from "zod";
export const projectPathSchema = z
  .string()
  .min(1)
  .refine(
    (path) => !path.startsWith("/") && !path.split(/[\\/]/).includes(".."),
    "Use a project-relative path",
  );
export const commandSchema = z.strictObject({
  command: z.string().min(1),
  args: z.array(z.string()),
  cwd: projectPathSchema.optional(),
  timeoutMs: z.number().int().min(1).max(300000).optional(),
});
export const checkSchema = z.strictObject({
  id: z.string().min(1),
  purpose: z.string().min(1),
  ...commandSchema.shape,
});
export const commandResultSchema = z.strictObject({
  command: commandSchema,
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean(),
  truncated: z.boolean(),
});
export const checkResultSchema = z.strictObject({
  id: z.string(),
  purpose: z.string(),
  ...commandResultSchema.shape,
});
export const snapshotSchema = z.record(
  z.string(),
  z.string().regex(/^[a-f0-9]{64}$/),
);
export const implementationChangeSchema = z.strictObject({
  paths: z
    .array(
      z.strictObject({
        path: projectPathSchema,
        lines: z.array(z.number().int().positive()).optional(),
      }),
    )
    .min(1),
  description: z.string().trim().min(1),
  origin_refs: z.array(z.string()),
});
