import * as z from "zod";

export const workflowProtocolVersion = "2026-10-08";

/** Shape validation is separate from the host's supported protocol check. */
export const workflowMetadataSchema = z.strictObject({
  type: z.literal("workflow"),
  version: z.string().min(1),
});
export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
