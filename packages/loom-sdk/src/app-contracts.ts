import * as z from "zod";
import { choicePresentationSchema } from "./capability.ts";
import { jsonSchemaSchema } from "./schema.ts";

export const appProtocolVersion = "1";
export const appMetaKey = "io.intloom/app";
export const appPresentationSchema = z.strictObject({
  appId: z.string(),
  loomName: z.string(),
  loomIdentity: z.string(),
  resourceUri: z.string(),
  toolName: z.string(),
  mimeType: z.literal("text/html;profile=mcp-app"),
});
export const appMethods = {
  read: "intloom_app_read",
  answer: "intloom_app_answer",
  operation: "intloom_app_operation",
} as const;
const error = z.strictObject({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export const appActionSchema = z.strictObject({
  actionId: z.string(),
  interactionId: z.string(),
  kind: z.enum(["form", "select", "confirm"]),
  title: z.string(),
  description: z.string().optional(),
  context: z.json(),
  contextSchema: jsonSchemaSchema,
  responseSchema: jsonSchemaSchema,
  presentation: z
    .strictObject({ choices: choicePresentationSchema })
    .optional(),
});
export const appSnapshotSchema = z.strictObject({
  appId: z.string(),
  run: z.strictObject({
    runId: z.string(),
    loomName: z.string(),
    loomVersion: z.string(),
    loomIdentity: z.string(),
    serviceInstanceId: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(["running", "waiting", "paused", "completed", "failed"]),
    settled: z.boolean(),
  }),
  view: z.union([
    z.strictObject({ mode: z.literal("interaction"), action: appActionSchema }),
    z.strictObject({
      mode: z.literal("status"),
      reason: z.enum([
        "running",
        "paused",
        "agent_pending",
        "handoff",
        "terminal",
      ]),
    }),
    z.strictObject({
      mode: z.literal("result"),
      outcome: z.literal("completed"),
      output: z.json(),
    }),
    z.strictObject({
      mode: z.literal("result"),
      outcome: z.literal("failed"),
      error: error.optional(),
      stopReason: z.string().optional(),
      evidenceRefs: z.array(z.json()),
    }),
  ]),
});
export type AppSnapshot = z.infer<typeof appSnapshotSchema>;
export type AppAction = z.infer<typeof appActionSchema>;
export const appBootstrapSchema = z.strictObject({
  protocolVersion: z.literal(appProtocolVersion),
  viewToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
  methods: z.strictObject({
    read: z.literal(appMethods.read),
    answer: z.literal(appMethods.answer),
    operation: z.literal(appMethods.operation),
  }),
  snapshot: appSnapshotSchema,
});
export type AppBootstrap = z.infer<typeof appBootstrapSchema>;
export const appReadSchema = z.strictObject({ viewToken: z.string().min(1) });
export const appAnswerSchema = appReadSchema.extend({
  serviceInstanceId: z.uuid(),
  operationId: z.uuid(),
  actionId: z.string().min(1),
  answer: z.json(),
});
export type AppAnswer = z.infer<typeof appAnswerSchema>;
export const appOperationSchema = appReadSchema.extend({
  serviceInstanceId: z.uuid(),
  operationId: z.uuid(),
});
/** The UI needs receipt state, not the service's full administrative response. */
export const appReceiptSchema = z.object({
  operationId: z.uuid(),
  serviceInstanceId: z.uuid(),
  status: z.enum(["pending", "accepted", "rejected", "indeterminate"]),
  error: error.optional(),
});
export const appAnswerResultSchema = z.strictObject({
  receipt: appReceiptSchema,
  snapshot: appSnapshotSchema.optional(),
});
export const appOperationResultSchema = z.union([
  z.strictObject({ status: z.literal("found"), receipt: appReceiptSchema }),
  z.strictObject({
    status: z.enum(["not_found", "instance_changed"]),
    serviceInstanceId: z.uuid(),
  }),
]);

/** JSON Pointer traversal never follows inherited properties. */
export function readPointer(value: unknown, pointer: string): unknown {
  if (pointer === "") return value;
  if (!/^(?:\/(?:[^~]|~[01])*)*$/.test(pointer))
    throw new Error("Invalid JSON Pointer");
  let current = value;
  for (const part of pointer.slice(1).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!current || typeof current !== "object" || !Object.hasOwn(current, key))
      return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
export function interactionChoices(
  context: unknown,
  mapping: z.infer<typeof choicePresentationSchema>,
) {
  const items = readPointer(context, mapping.itemsPath);
  if (!Array.isArray(items)) throw new Error("Choice items must be an array");
  const seen = new Set<string>();
  return items.map((item) => {
    const value = readPointer(item, mapping.valuePath);
    const label = readPointer(item, mapping.labelPath);
    if (
      !["string", "number", "boolean"].includes(typeof value) ||
      typeof label !== "string" ||
      (typeof value === "number" && !Number.isFinite(value))
    )
      throw new Error("Invalid choice value or label");
    const key = JSON.stringify(value);
    if (seen.has(key)) throw new Error("Duplicate choice value");
    seen.add(key);
    return { value: value as string | number | boolean, label, context: item };
  });
}
export function choiceAnswer(
  pointer: string,
  value: string | number | boolean,
): Record<string, unknown> {
  if (!pointer.startsWith("/"))
    throw new Error("Choice response requires a field");
  const result: Record<string, unknown> = {};
  let current = result;
  const parts = pointer
    .slice(1)
    .split("/")
    .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
  for (const [index, key] of parts.entries()) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Unsafe choice response path");
    if (index === parts.length - 1) current[key] = value;
    else {
      const next = {};
      current[key] = next;
      current = next;
    }
  }
  return result;
}
