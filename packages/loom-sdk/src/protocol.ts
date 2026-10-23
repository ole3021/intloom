import * as z from "zod";

export const loomProtocolVersion = "2026-10-15";

/** Metadata in a compiled package's package.json loom field; protocol support is checked by the host. */
export const loomMetadataSchema = z.strictObject({
  type: z.literal("loom"),
  version: z.string().min(1),
});
export type LoomMetadata = z.infer<typeof loomMetadataSchema>;

/** Shared names in source definitions and compiled topology. */
export const loomNameSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value.trim() === value &&
      !["__proto__", "prototype", "constructor"].includes(value),
    "Invalid or reserved name",
  );
export const codeIdSchema = z.string().regex(/^CODE-[\w-]{21}$/);
export const agentIdSchema = z.string().regex(/^AGENT-[\w-]{21}$/);
export type CodeId = z.infer<typeof codeIdSchema>;
export type AgentId = z.infer<typeof agentIdSchema>;
