import {
  askInputSchema,
  loomIdSchema,
  loomInputSchema,
  packageIdentitySchema,
  type AskSubmission,
  type LoomInput,
  type PackageIdentity,
  type RunResult,
} from "@intloom/loom-sdk";
import { z } from "zod";
import {
  pageOptionsSchema,
  type PageOptions,
} from "../persistence/pagination.ts";
import type { CleanupFailure } from "../tools/fs.ts";
import type { Interaction, SubmissionResult } from "../tools/interactions.ts";

export const runIdSchema = z.uuid();
export const runPhaseSchema = z.enum([
  "preparing",
  "running",
  "cancelling",
  "finalizing",
  "finished",
]);
export type RunPhase = z.infer<typeof runPhaseSchema>;
export const environmentSchema = z.record(
  z
    .string()
    .min(1)
    .refine((key) => !/[=\0]/.test(key)),
  z.string().refine((value) => !value.includes("\0")),
);
export const startRunSchema = z.strictObject({
  package: packageIdentitySchema,
  input: loomInputSchema,
  workDir: z.string().min(1).optional(),
  env: environmentSchema.optional(),
});
export type StartRunInput = z.infer<typeof startRunSchema>;
export const authorizationRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("path"),
    path: z.string(),
    operation: z.enum(["read", "write"]),
  }),
  z.strictObject({
    kind: z.literal("command"),
    command: z.string(),
    args: z.array(z.string()).readonly(),
    cwd: z.string(),
    env: environmentSchema.optional(),
  }),
]);
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
export const authorizationAnswerSchema = z.enum(["once", "run", "deny"]);
export type AuthorizationAnswer = z.infer<typeof authorizationAnswerSchema>;
export const interactionSchema = z.strictObject({
  id: z.uuid(),
  question: askInputSchema,
  status: z.enum(["pending", "deferred"]),
  draft: z.json().optional(),
  issues: z
    .array(
      z.strictObject({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      }),
    )
    .readonly(),
});
export type RunInteraction = {
  readonly id: string;
  readonly executionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status:
    | "pending"
    | "deferred"
    | "answered"
    | "skipped"
    | "cancelled";
} & (
  | {
      readonly kind: "question";
      readonly question: Interaction["question"];
      readonly issues: Interaction["issues"];
      readonly draft?: Interaction["draft"];
    }
  | { readonly kind: "authorization"; readonly request: AuthorizationRequest }
);
export interface RuntimeOwner {
  readonly id: string;
  readonly pid: number;
}
export interface RunProcess {
  readonly pid: number;
  readonly kind: "execution" | "command";
}
export interface RunRecord {
  readonly runId: string;
  readonly package: PackageIdentity;
  readonly input: LoomInput;
  readonly scope: "intloom" | "workspace";
  readonly workDir: string;
  readonly tempDir: string;
  readonly owner: RuntimeOwner;
  readonly phase: RunPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly entryExecutionId?: string;
  readonly processes: readonly RunProcess[];
  readonly interactions: readonly RunInteraction[];
  readonly cleanupFailures: readonly CleanupFailure[];
  readonly interruption?: {
    readonly detectedAt: string;
    readonly phase: RunPhase;
    readonly reason: string;
  };
  readonly result?: RunResult;
}
export interface RunQuery extends PageOptions {
  readonly loomId?: string;
  readonly phase?: RunPhase;
}
export const runQuerySchema = pageOptionsSchema.extend({
  loomId: loomIdSchema.optional(),
  phase: runPhaseSchema.optional(),
});
export type RunEvent = {
  readonly runId: string;
  readonly sequence: number;
  readonly cursor: string;
  readonly at: string;
} & (
  | { readonly type: "created"; readonly data: RunRecord }
  | { readonly type: "phase"; readonly data: { readonly phase: RunPhase } }
  | {
      readonly type: "execution";
      readonly data: {
        readonly executionId: string;
        readonly action: "created" | "completed";
      };
    }
  | { readonly type: "interaction"; readonly data: RunInteraction }
  | {
      readonly type: "answer";
      readonly data: {
        readonly id: string;
        readonly answer: AskSubmission | AuthorizationAnswer;
        readonly result: SubmissionResult;
      };
    }
  | {
      readonly type: "process";
      readonly data: { readonly process: RunProcess; readonly active: boolean };
    }
  | {
      readonly type: "interrupted";
      readonly data: NonNullable<RunRecord["interruption"]>;
    }
  | { readonly type: "finished"; readonly data: RunResult }
);
export type RunEventInput = RunEvent extends infer E
  ? E extends RunEvent
    ? Omit<E, "runId" | "sequence" | "cursor" | "at">
    : never
  : never;

export class RunInterruptedError extends Error {
  override readonly name = "RunInterruptedError";
  constructor(readonly run: RunRecord) {
    super(
      `Run ${run.runId} was interrupted; confirm its processes stopped before finalizing`,
    );
  }
}
