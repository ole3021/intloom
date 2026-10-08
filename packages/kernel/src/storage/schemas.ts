import * as z from "zod";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import type { StorageOperation } from "./types.ts";
import { invalid } from "./errors.ts";

export const nameSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !/[\uD800-\uDFFF]/u.test(value) &&
      !/\p{Cc}/u.test(value),
    "Expected a nonempty, well-formed string without control characters",
  );
export const revisionSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const timestampSchema = z.iso
  .datetime({ precision: 3 })
  .refine((value) => new Date(value).toISOString() === value);
export const payloadSchema = z.strictObject({
  flowName: nameSchema,
  stageName: nameSchema,
  data: z.json(),
});
export const artifactSchema = payloadSchema.extend({
  id: nameSchema,
  revision: revisionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const recordSchema = payloadSchema.extend({
  id: nameSchema,
  createdAt: timestampSchema,
});
const operationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("create_artifact"),
    id: nameSchema,
    payload: payloadSchema,
  }),
  z.strictObject({
    type: z.literal("replace_artifact"),
    id: nameSchema,
    expectedRevision: revisionSchema,
    payload: payloadSchema,
  }),
  z.strictObject({
    type: z.literal("append_record"),
    id: nameSchema,
    payload: payloadSchema,
  }),
  z.strictObject({
    type: z.literal("remove_artifact"),
    id: nameSchema,
    expectedRevision: revisionSchema,
  }),
  z.strictObject({ type: z.literal("remove_record"), id: nameSchema }),
]);
export const querySchema = z
  .strictObject({
    flowName: nameSchema.optional(),
    stageName: nameSchema.optional(),
    ids: z.array(nameSchema).optional(),
    createdAfter: timestampSchema.optional(),
    createdBefore: timestampSchema.optional(),
    order: z.enum(["created_asc", "created_desc"]).default("created_desc"),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().min(1).max(16384).optional(),
  })
  .refine(
    (q) =>
      !q.createdAfter || !q.createdBefore || q.createdAfter < q.createdBefore,
    "Invalid time range",
  );

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (cause) {
    throw KERNEL_ERRORS.wrap("INVALID_REQUEST", cause);
  }
}

export function parseOperations(
  value: readonly StorageOperation[],
): StorageOperation[] {
  const operations = parseInput(z.array(operationSchema), value);
  const keys = new Set<string>();
  for (const operation of operations) {
    const key = JSON.stringify([
      operation.type.endsWith("_artifact") ? "artifact" : "record",
      operation.id,
    ]);
    if (keys.has(key))
      invalid("A batch cannot target the same category and ID more than once.");
    keys.add(key);
  }
  return operations;
}
