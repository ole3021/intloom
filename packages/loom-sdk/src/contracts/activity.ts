import type {
  ExecutionKind,
  ExecutionStatus,
  ModelRequestProgress,
} from "./events.ts";
import type { ArtifactRecord, ExecutionOrigin } from "./outcome.ts";
import type { InteractionRequest } from "./interaction.ts";
import type { RunResult, RunSummary } from "./run.ts";

export interface ExecutionActivity {
  readonly id: string;
  readonly parentExecutionId?: string;
  readonly kind: ExecutionKind;
  readonly origin?: ExecutionOrigin;
  readonly model?: {
    readonly slot: string;
    readonly provider: string;
    readonly model: string;
  };
  readonly request?: ModelRequestProgress & { readonly time: string };
  readonly usage?: ModelUsage;
  readonly summary?: string;
  readonly status: ExecutionStatus;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly activeDurationMs: number;
  readonly waitingDurationMs: number;
  readonly history: "complete" | "unavailable";
}
export interface StepActivity {
  readonly path: readonly string[];
  readonly label: string;
  readonly source: string;
  readonly conditional: boolean;
  readonly counts: Readonly<Record<ExecutionStatus, number>>;
  readonly activeDurationMs: number;
  readonly waitingDurationMs: number;
}
export interface ModelUsage {
  readonly calls: number;
  readonly finishedCalls: number;
  readonly observedSteps: number;
  readonly inputTokens: {
    readonly reported: number;
    readonly receipts: number;
  };
  readonly outputTokens: {
    readonly reported: number;
    readonly receipts: number;
  };
  readonly costs: Readonly<
    Record<string, { readonly reported: number; readonly receipts: number }>
  >;
  readonly costsWithoutCurrency: number;
  readonly complete: boolean;
}
export interface RunActivityView {
  readonly run: RunSummary;
  readonly throughSeq: number;
  readonly coverage: "complete" | "partial";
  readonly steps: readonly StepActivity[];
  readonly progress: {
    readonly completed: number;
    readonly active: number;
    readonly total?: number;
  };
  readonly activeExecutions: readonly ExecutionActivity[];
  /** Last 20 ended Agent, Tool, Code and Model calls, in finish-event order. */
  readonly recentExecutions: readonly ExecutionActivity[];
  readonly finishedExecutionCount: number;
  readonly interactions: readonly InteractionRequest[];
  readonly artifacts: readonly ArtifactRecord[];
  readonly result: Omit<RunResult, "output">;
  readonly usage: ModelUsage;
  readonly validation?: {
    readonly status: "running" | "passed" | "failed" | "incomplete";
    readonly durationMs?: number;
    readonly code?: string;
  };
}
