import * as z from "zod";
const identity = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim().length > 0);
export const agentRefSchema = z.strictObject({
  runId: identity,
  callId: identity,
});
export const agentOwnerSchema = agentRefSchema.extend({ ownerToken: identity });
export const agentClaimSchema = agentRefSchema.extend({ claimId: identity });
export const agentToolSchema = agentOwnerSchema.extend({
  toolCallId: identity,
  toolId: identity,
  input: z.json(),
});
export const agentAssetSchema = agentOwnerSchema.extend({ assetId: identity });
export const agentCompleteSchema = agentOwnerSchema.extend({
  result: z.json(),
});
export const agentFailureSchema = agentOwnerSchema.extend({
  message: z.string().min(1).max(4096),
});
export const agentTaskSchema = z.strictObject({
  runId: identity,
  callId: identity,
  agentId: identity,
  cursor: z.strictObject({ stageName: z.string(), stepName: z.string() }),
  instructions: z.string(),
  skills: z.array(
    z.strictObject({
      name: z.string(),
      description: z.string(),
      content: z.string(),
      assets: z.array(z.strictObject({ id: z.string(), name: z.string() })),
    }),
  ),
  tools: z.array(
    z.strictObject({
      id: z.string(),
      description: z.string(),
      inputSchema: z.json(),
      outputSchema: z.json(),
    }),
  ),
  input: z.json().optional(),
  outputSchema: z.json(),
});
export const agentCallViewSchema = z.strictObject({
  pending: z.strictObject({
    id: identity,
    agentId: identity,
    phase: z.enum(["available", "claimed"]),
    createdAt: z.iso.datetime(),
  }),
  task: agentTaskSchema,
  receipts: z.array(
    z.strictObject({
      toolCallId: identity,
      toolId: identity,
      status: z.enum(["running", "completed", "failed"]),
    }),
  ),
});
export const agentClaimResultSchema = z.strictObject({
  task: agentTaskSchema,
  ownerToken: identity,
});
export const agentAssetResultSchema = z.strictObject({
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]),
});
