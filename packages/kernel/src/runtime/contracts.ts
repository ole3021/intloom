import type { LoomInput } from "@intloom/loom-sdk";
import type { ExecutableAgent } from "../effector/execution.ts";
import type { RunExecution, RunSource } from "./execution-policy.ts";
import type { Effector } from "../effector/contracts.ts";
import type { Logger } from "@intloom/utils";
import type { CodeRegistry } from "../loom/registries.ts";
import type { StorageAccess } from "../storage/contracts.ts";
import type { Blueprint } from "../loom/blueprint.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import type { RunView } from "./run-view.ts";
import type { AgentCallApi } from "./agent-call-types.ts";
import type { AgentRegistry } from "../loom/registries.ts";
import type { RunCheckpointStore } from "./recovery/store.ts";

/** Execution resources supplied after project initialization, without business access bound to a specific Run. */
export interface RuntimeOptions {
  readonly mirror?: {
    assertOpen(): void;
    capture(
      entry: import("./run-entry.ts").RunEntry,
      checkpoint: import("./recovery/store.ts").RunCheckpoint,
      pending: NonNullable<
        import("../mirror/contracts.ts").MirrorControl["capturePending"]
      >,
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
  readonly prepareExecution?: (
    blueprint: Blueprint,
    source: RunSource,
  ) => Promise<RunExecution>;
  readonly effector: Effector;
  readonly storage: StorageAccess;
}

/** Each project execution environment owns one Runtime, which executes only initialized Blueprints. */
export interface Runtime extends AgentCallApi {
  /** Called once by the host before accepting requests. */
  restore(): Promise<void>;
  /** Releases live execution while retaining recovery copies; unlike cancel, unfinished work can be recovered. */
  suspend(): Promise<void>;
  /** Admits a Run and returns its initial running snapshot without waiting for execution. */
  startRun(
    blueprint: Blueprint,
    input: LoomInput,
    source?: RunSource,
  ): Promise<RunView>;
  /** Preserves the declared inputs and returns a snapshot after reaching waiting/completed/failed. */
  run(
    blueprint: Blueprint,
    input: LoomInput,
    source?: RunSource,
  ): Promise<RunView>;
  resumeRun(
    runId: string,
    request: {
      operationId: string;
      abandonMirror?: boolean | undefined;
      scope?: import("../mirror/contracts.ts").MirrorScope | undefined;
      expectedRevision?: number;
      serviceInstanceId?: string;
    },
  ): Promise<RunView>;
  getRun(runId: string): Promise<RunView>;
  listRuns(loomName?: string): Promise<RunView[]>;
  /** Accepts a valid answer synchronously and returns the resumed running snapshot. */
  submitAnswer(
    runId: string,
    actionId: string,
    answer: ReadonlyJsonValue,
  ): RunView;
  /** actionId matches pendingAction.id; invalid or stale answers preserve the action and timestamps. */
  answerAsk(
    runId: string,
    actionId: string,
    answer: ReadonlyJsonValue,
  ): Promise<RunView>;
  /** Logically cancels the Run as failed/RUN_STOPPED without rolling back external effects. */
  cancelRun(runId: string): Promise<void>;
  cancelAllRuns(): Promise<void>;
}
