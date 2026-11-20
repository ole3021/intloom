import {
  executionResultSchema,
  loomIdSchema,
  packageIdentitySchema,
  type ExecutionResult,
  type JsonValue,
  type PackageIdentity,
} from "@intloom/loom-sdk";
import { z } from "zod";
import {
  pageOptionsSchema,
  type PageOptions,
} from "../persistence/pagination.ts";

export const executionIdSchema = z.uuid();

const executionFields = {
  package: packageIdentitySchema,
  kind: z.enum(["code", "agent", "workflow"]),
  input: z.unknown().optional(),
  parentId: executionIdSchema.optional(),
};
export const executionAssociationSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("chat") }),
  z.strictObject({ mode: z.literal("run"), runId: executionIdSchema }),
  z.strictObject({
    mode: z.literal("patch"),
    runId: executionIdSchema,
    patchId: z.string().regex(/^PCH-\d{4,}$/),
  }),
]);
export type ExecutionAssociation = z.infer<typeof executionAssociationSchema>;
export type CreateExecution = {
  readonly package: PackageIdentity;
  readonly kind: "code" | "agent" | "workflow";
  readonly input?: JsonValue;
} & (
  | (ExecutionAssociation & { readonly parentId?: never })
  | { readonly parentId: string; readonly mode?: never }
);
export const createExecutionSchema = z.union([
  ...executionAssociationSchema.options.map((schema) =>
    schema.extend({ ...executionFields, parentId: z.never().optional() }),
  ),
  z.strictObject({
    ...executionFields,
    parentId: executionIdSchema,
  }),
]);

export interface CompleteExecution {
  readonly result: ExecutionResult;
  readonly value?: JsonValue;
}

export const completeExecutionSchema = z.strictObject({
  result: executionResultSchema,
  value: z.unknown().optional(),
});

export interface ExecutionCompletion extends CompleteExecution {
  readonly completedAt: string;
}

export type ExecutionRecord = ExecutionAssociation & {
  readonly package: PackageIdentity;
  readonly kind: "code" | "agent" | "workflow";
  readonly input?: JsonValue;
  readonly parentId?: string;
  readonly executionId: string;
  readonly createdAt: string;
  readonly completion?: ExecutionCompletion;
};

export interface ExecutionQuery extends PageOptions {
  readonly loomId?: string;
  readonly runId?: string;
  readonly mode?: ExecutionAssociation["mode"];
  readonly status?: "recorded" | ExecutionResult["status"];
}

export const executionQuerySchema = pageOptionsSchema.extend({
  loomId: loomIdSchema.optional(),
  runId: executionIdSchema.optional(),
  mode: z.enum(["chat", "run", "patch"]).optional(),
  status: z
    .enum(["recorded", "succeeded", "failed", "rejected", "cancelled"])
    .optional(),
});

export type ExecutionEvent = {
  readonly sequence: number;
  readonly executionId: string;
  readonly at: string;
} & (
  | { readonly type: "recorded"; readonly data: ExecutionRecord }
  | { readonly type: "completed"; readonly data: ExecutionCompletion }
);
