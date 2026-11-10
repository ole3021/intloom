import type { JsonObject } from "./json.ts";
import type { ExecutionOrigin, QualityStatus } from "./outcome.ts";
import type { ResponseSource } from "./interaction.ts";

export type ExecutionKind =
  | "workflow"
  | "step"
  | "agent"
  | "tool"
  | "code"
  | "model";
export type ExecutionStatus =
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "incomplete";
export interface EventScope {
  readonly executionId?: string;
  readonly parentExecutionId?: string;
  readonly operationId?: string;
  readonly origin?: ExecutionOrigin;
}
export interface ExecutionScope extends EventScope {
  readonly executionId: string;
  readonly origin: ExecutionOrigin;
}
type Finished = {
  readonly status: "succeeded" | "failed" | "cancelled";
  readonly durationMs: number;
};
type Invocation = { readonly invocationId: string };
type Payload =
  | {
      readonly type:
        | "run.created"
        | "run.succeeded"
        | "run.failed"
        | "run.cancelled"
        | "run.interrupted";
    }
  | {
      readonly type: "run.started" | "run.resumed" | "run.resume.requested";
      readonly details?: { readonly waitId?: string };
    }
  | {
      readonly type: "run.waiting";
      readonly details: { readonly waitIds: readonly string[] };
    }
  | {
      readonly type: "run.stopping";
      readonly details: {
        readonly reason: "error" | "cancel";
        readonly code?: string;
      };
    }
  | { readonly type: "run.recovery.changed" }
  | {
      readonly type:
        | `${"workflow" | "step"}.started`
        | `${"workflow" | "step"}.resumed`;
      readonly details?: { readonly history?: "unavailable" };
    }
  | {
      readonly type: `${"workflow" | "step"}.waiting`;
      readonly details: {
        readonly durationMs?: number;
        readonly history?: "unavailable";
      };
    }
  | { readonly type: `${"agent" | "tool" | "code"}.started` }
  | {
      readonly type: `${"workflow" | "step" | "agent" | "code"}.finished`;
      readonly details: Finished;
    }
  | {
      readonly type: "tool.finished";
      readonly details: Finished & { readonly summary?: string };
    }
  | {
      readonly type: "model.invocation.started";
      readonly details: Invocation & {
        readonly slot: string;
        readonly provider: string;
        readonly model: string;
      };
    }
  | {
      readonly type: "model.step.finished";
      readonly details: Invocation & {
        readonly step: number;
        readonly inputTokens?: number;
        readonly outputTokens?: number;
        readonly reportedCost?: number;
        readonly currency?: string;
      };
    }
  | {
      readonly type: "model.invocation.finished";
      readonly details: Invocation & {
        readonly status: Finished["status"];
        readonly stepCount: number;
        readonly durationMs?: number;
      };
    }
  | {
      readonly type: "child.created";
      readonly details: {
        readonly childRunId: string;
        readonly callId: string;
      };
    }
  | {
      readonly type: "interaction.requested";
      readonly details: {
        readonly requestId: string;
        readonly waitId: string;
        readonly kind: "ask" | "approval";
      };
    }
  | {
      readonly type: "interaction.responded";
      readonly details: {
        readonly requestId: string;
        readonly responseId: string;
        readonly action: "submit" | "decline" | "dismiss";
        readonly kind: "ask" | "approval";
        readonly source: ResponseSource;
        readonly approved?: boolean;
      };
    }
  | {
      readonly type: "interaction.closed";
      readonly details: {
        readonly requestId: string;
        readonly reason: "run_ended";
      };
    }
  | {
      readonly type: "wait.accepted";
      readonly details: {
        readonly waitId: string;
        readonly source?: ResponseSource;
      };
    }
  | {
      readonly type: "artifact.created";
      readonly details: { readonly artifactId: string };
    }
  | {
      readonly type: "acceptance.recorded";
      readonly details: {
        readonly acceptanceId: string;
        readonly status: "passed" | "rejected" | "error";
      };
    }
  | {
      readonly type: "outcome.delivered";
      readonly details: { readonly quality: QualityStatus };
    }
  | { readonly type: "validation.started" }
  | {
      readonly type: "validation.finished";
      readonly details: {
        readonly status: "passed" | "failed";
        readonly durationMs: number;
        readonly code?: string;
      };
    }
  | {
      readonly type: "log";
      readonly details: {
        readonly level: string;
        readonly message: string;
        readonly data?: JsonObject;
      };
    };
type WithDetails<T> = T extends { readonly details?: unknown }
  ? T
  : T & { readonly details?: never };
type Scoped<T> = T extends {
  readonly type:
    | `${ExecutionKind}.${string}`
    | `interaction.${string}`
    | "artifact.created"
    | "acceptance.recorded"
    | "child.created";
}
  ? T & ExecutionScope
  : T & EventScope;
export type RunEventInput = Scoped<WithDetails<Payload>>;
export type RunEvent = RunEventInput & {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly seq: number;
  readonly time: string;
};
export interface RunEventsCommitted {
  readonly runId: string;
  readonly throughSeq: number;
}

export interface RunEventPage {
  readonly items: readonly RunEvent[];
  readonly nextAfter?: number;
}
