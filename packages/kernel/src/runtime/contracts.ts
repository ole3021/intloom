import type { MutationResult } from "./mutation.ts";
import type { LoomInput } from "@intloom/loom-sdk";
import type { ExecutableAgent } from "../execution/execution.ts";
import type { RunExecution } from "./execution-policy.ts";
import type { Execution } from "../execution/contracts.ts";
import type { Logger } from "@intloom/utils";
import type { CodeRegistry } from "../loom/registries.ts";
import type { StorageAccess } from "@intloom/loom-sdk";
import type { Blueprint } from "@intloom/loom-sdk";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { RunView } from "./run-view.ts";
import type { AgentRegistry } from "../loom/registries.ts";
import type { RunCheckpointStore } from "./recovery/contracts.ts";

/** Execution resources supplied after project initialization, without business access bound to a specific Run. */
export interface RuntimeOptions {
  readonly mirror?: {
    assertOpen(): void;
    capture(
      checkpoint: import("./recovery/contracts.ts").CheckpointSnapshot,
      pending: NonNullable<
        import("../mirror/contracts.ts").MirrorControl["capturePending"]
      >,
      observation: () => Pick<RunView, "metrics" | "results" | "settled">,
    ): Promise<void>;
  };
  readonly project?: import("@intloom/loom-sdk").ProjectAccess;
  readonly recovery?: {
    readonly store: RunCheckpointStore;
    readonly blueprints: Readonly<Record<string, Blueprint>>;
    readonly loomIdentities: Readonly<Record<string, string>>;
  };
  readonly observation?: import("./run-observation.ts").RuntimeObservation;
  readonly logger?: Logger;
  readonly signal?: AbortSignal;
  readonly codes: CodeRegistry;
  readonly agents: Readonly<Record<string, ExecutableAgent>>;
  readonly agentResources?: AgentRegistry;
  readonly validateExecution?: (
    blueprint: Blueprint,
    saved: RunExecution,
  ) => Promise<void>;
  readonly executor: Execution;
  readonly storage: StorageAccess;
}

/** Each project execution environment owns one Runtime, which executes only initialized Blueprints. */
export interface Runtime {
  watchRun(runId: string, observe: (view: RunView) => void): () => void;
  /** Called once by the host before accepting requests. */
  restore(): Promise<void>;
  /** Releases live execution while retaining recovery copies; unlike cancel, unfinished work can be recovered. */
  suspend(): Promise<void>;
  /** Admits a Run and returns its initial running snapshot without waiting for execution. */
  startRun(
    blueprint: Blueprint,
    input: LoomInput,
    execution: RunExecution,
    startedBy?: OperationRef,
  ): Promise<MutationResult<RunView>>;
  resumeRun(
    runId: string,
    request: {
      operationId: string;
      abandonMirror?: boolean | undefined;
      scope?: import("../mirror/contracts.ts").MirrorScope | undefined;
      expectedRevision?: number;
      serviceInstanceId?: string;
    },
  ): Promise<MutationResult<RunView>>;
  findRun(startedBy: OperationRef): Promise<RunView | undefined>;
  getRun(runId: string): Promise<RunView>;
  listRuns(loomName?: string): Promise<RunView[]>;
  /** Accepts a valid answer synchronously and returns the resumed running snapshot. */
  submitAnswer(
    runId: string,
    actionId: string,
    answer: ReadonlyJsonValue,
    operation?: OperationRef,
  ): MutationResult<RunView>;
  /** Logically cancels the Run as failed/RUN_STOPPED without rolling back external effects. */
  cancelRun(runId: string): Promise<MutationResult<RunView>>;
  pauseRun(runId: string): Promise<MutationResult<RunView>>;
  cancelAllRuns(): Promise<void>;
}

export interface OperationRef {
  readonly serviceInstanceId: string;
  readonly operationId: string;
}
