import { loomInputSchema } from "@intloom/loom-sdk";
import { resumeRunSchema } from "./mirrors.ts";
export { resumeRunSchema };
import * as z from "zod";
import {
  errorViewSchema,
  runViewSchema,
  runViewDataSchema,
  serviceStatusSchema,
  loomViewSchema,
} from "../host/contracts.ts";
import type { RunView } from "../runtime/run-view.ts";

export const coreMetaSchema = z.strictObject({
  requestId: z.string().min(1),
  projectRoot: z.string().optional(),
  serviceInstanceId: z.uuid().optional(),
  operationId: z.uuid().optional(),
  runId: z.string().optional(),
});
export type CoreMeta = z.infer<typeof coreMetaSchema>;
export type CoreResult<T> =
  | { readonly ok: true; readonly data: T; readonly meta: CoreMeta }
  | {
      readonly ok: false;
      readonly error: z.infer<typeof errorViewSchema>;
      readonly outcome: "not_applied" | "applied" | "unknown";
      readonly meta: CoreMeta;
      readonly data?: T;
    };
export function coreResultSchema<T>(
  data: z.ZodType<T>,
): z.ZodType<CoreResult<T>> {
  const success = z.strictObject({
    ok: z.literal(true),
    data,
    meta: coreMetaSchema,
  });
  const rejected = z.strictObject({
    ok: z.literal(false),
    error: errorViewSchema,
    outcome: z.enum(["not_applied", "applied", "unknown"]),
    meta: coreMetaSchema,
    data: data.optional(),
  });
  return z.union([success, rejected]).transform((value): CoreResult<T> => {
    if (value.ok) return { ok: true, data: value.data, meta: value.meta };
    return {
      ok: false,
      error: value.error,
      outcome: value.outcome,
      meta: value.meta,
      ...(value.data === undefined ? {} : { data: value.data }),
    };
  });
}
export const serviceRunViewSchema = runViewDataSchema
  .extend({
    serviceInstanceId: z.uuid(),
    revision: z.number().int().positive(),
  })
  .transform(
    ({ serviceInstanceId, revision, ...run }): ServiceRunView => ({
      ...runViewSchema.parse(run),
      serviceInstanceId,
      revision,
    }),
  );
export type ServiceRunView = RunView & {
  readonly serviceInstanceId: string;
  readonly revision: number;
};
export const operationReceiptSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("pending"),
    serviceInstanceId: z.uuid(),
    operationId: z.uuid(),
    kind: z.enum(["run", "answer", "resume", "stop", "pause"]),
  }),
  z.strictObject({
    status: z.literal("accepted"),
    serviceInstanceId: z.uuid(),
    operationId: z.uuid(),
    kind: z.enum(["run", "answer", "resume", "stop", "pause"]),
    runId: z.string(),
    acceptedAt: z.iso.datetime(),
    acceptedRevision: z.number().int().positive(),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    serviceInstanceId: z.uuid(),
    operationId: z.uuid(),
    kind: z.enum(["run", "answer", "resume", "stop", "pause"]),
    error: errorViewSchema,
  }),
  z.strictObject({
    status: z.literal("indeterminate"),
    serviceInstanceId: z.uuid(),
    operationId: z.uuid(),
    kind: z.enum(["run", "answer", "resume", "stop", "pause"]),
    runId: z.string().optional(),
    error: errorViewSchema,
  }),
]);
export type OperationReceipt = z.infer<typeof operationReceiptSchema>;
export const admissionSchema = z.strictObject({
  receipt: operationReceiptSchema,
  run: serviceRunViewSchema.optional(),
});
export type Admission = {
  readonly receipt: OperationReceipt;
  readonly run?: ServiceRunView;
};
export const serviceApiInfoSchema = serviceStatusSchema.extend({
  apiVersion: z.literal(1),
  capabilities: z.array(z.string()),
});
export const projectEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("project_snapshot"),
    serviceInstanceId: z.uuid(),
    service: serviceApiInfoSchema,
    looms: z.array(loomViewSchema),
    runs: z.array(serviceRunViewSchema),
  }),
  z.strictObject({
    type: z.literal("run_snapshot"),
    serviceInstanceId: z.uuid(),
    run: serviceRunViewSchema,
  }),
  z.strictObject({
    type: z.literal("service_snapshot"),
    serviceInstanceId: z.uuid(),
    service: serviceApiInfoSchema,
  }),
  z.strictObject({
    type: z.literal("service_closing"),
    serviceInstanceId: z.uuid(),
  }),
]);
export type ProjectEvent = z.infer<typeof projectEventSchema>;
export const runRequestSchema = z.strictObject({
  operationId: z.uuid(),
  loomName: z.string().refine((value) => value.trim().length > 0),
  input: loomInputSchema,
});
export const answerRequestSchema = z.strictObject({
  operationId: z.uuid(),
  actionId: z.string().min(1),
  answer: z.json(),
});

export const operationQuerySchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("found"),
    receipt: operationReceiptSchema,
  }),
  z.strictObject({
    status: z.literal("not_found"),
    serviceInstanceId: z.uuid(),
  }),
  z.strictObject({
    status: z.literal("instance_changed"),
    serviceInstanceId: z.uuid(),
  }),
]);
export type OperationQuery = z.infer<typeof operationQuerySchema>;
export const agentSubmissionReceiptSchema = z.strictObject({
  runId: z.string(),
  callId: z.string(),
  status: z.literal("accepted"),
});
