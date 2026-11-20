import { z } from "zod";
import { absolutePathSchema } from "../loom/input.ts";

export const rejectInputSchema = z.strictObject({
  reason: z.string().trim().min(1),
});
export const executionResultSchema = z.union([
  z.strictObject({ status: z.literal("succeeded") }),
  z.strictObject({
    status: z.enum(["failed", "rejected", "cancelled"]),
    reason: z.string().trim().min(1),
  }),
]);
export type ExecutionResult = z.infer<typeof executionResultSchema>;

export const outputIssueSchema = z.strictObject({
  name: z.string().min(1),
  path: absolutePathSchema,
  reason: z.string().min(1),
});
export type OutputIssue = z.infer<typeof outputIssueSchema>;
export const outputCheckSchema = z.union([
  z.strictObject({
    status: z.enum(["none", "ready"]),
    issues: z.tuple([]).readonly(),
  }),
  z.strictObject({
    status: z.literal("incomplete"),
    issues: z.tuple([outputIssueSchema]).rest(outputIssueSchema).readonly(),
  }),
]);
export type OutputCheck = z.infer<typeof outputCheckSchema>;
const artifactFields = {
  description: z.string().optional(),
  source: z.strictObject({
    runId: z.uuid(),
    patchId: z
      .string()
      .regex(/^PCH-\d{4,}$/)
      .optional(),
  }),
};
export const artifactRefSchema = z.union([
  z.strictObject({
    ...artifactFields,
    type: z.enum(["markdown", "file", "folder"]),
    path: absolutePathSchema,
  }),
  z.strictObject({
    ...artifactFields,
    type: z.literal("files"),
    paths: z.array(absolutePathSchema).min(1).readonly(),
  }),
]);
export type ArtifactRef = z.infer<typeof artifactRefSchema>;
export const runResultSchema = z.strictObject({
  runId: z.uuid(),
  execution: executionResultSchema,
  outputs: z.union(
    outputCheckSchema.options.map((schema) =>
      schema.extend({
        result: z.record(z.string(), artifactRefSchema).readonly(),
        current: z.record(z.string(), artifactRefSchema).readonly(),
      }),
    ),
  ),
});
export interface RunResult {
  readonly runId: string;
  readonly execution: ExecutionResult;
  readonly outputs: OutputCheck & {
    readonly result: Readonly<Record<string, ArtifactRef>>;
    readonly current: Readonly<Record<string, ArtifactRef>>;
  };
}

// Installed Looms and the executor can load separate copies of the SDK.
const rejectedBrand = Symbol.for("@intloom/ExecutionRejectedError");
const cancelledBrand = Symbol.for("@intloom/ExecutionCancelledError");

export class ExecutionRejectedError extends Error {
  readonly [rejectedBrand] = true;
  override readonly name = "ExecutionRejectedError";
  static [Symbol.hasInstance](error: unknown): boolean {
    return (
      error instanceof Error &&
      rejectedBrand in error &&
      error[rejectedBrand] === true
    );
  }
}

export class ExecutionCancelledError extends Error {
  readonly [cancelledBrand] = true;
  override readonly name = "ExecutionCancelledError";
  static [Symbol.hasInstance](error: unknown): boolean {
    return (
      error instanceof Error &&
      cancelledBrand in error &&
      error[cancelledBrand] === true
    );
  }
  constructor(message = "Execution cancelled") {
    super(message);
  }
}
