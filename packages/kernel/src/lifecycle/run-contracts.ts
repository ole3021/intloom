import type {
  ExecutionError,
  RunEvent,
  InstalledLoomRef,
  LoomSelector,
  JsonObject,
  JsonValue,
  LoomManifest,
  RunView,
  RunSummary,
  RunStatus,
  RunBindings,
  InteractionRequest,
  InteractionResponseRecord,
  RunWaitView,
  ResponseSource,
  RuntimeContext,
  ExecutionScope,
  RunEventInput,
  RunEventsCommitted,
  ArtifactRecord,
} from "@intloom/loom-sdk";
import type {
  OutcomeRepository,
  OutcomeProjection,
} from "../outcomes/contracts.ts";

export interface RunBinding {
  readonly location: import("@intloom/loom-sdk").RunLocation;
  readonly projectDir?: string;
  readonly formatVersion: 1;
  readonly loom: InstalledLoomRef;
  readonly dependencies: readonly InstalledLoomRef[];
  readonly entry: LoomManifest["entry"];
  readonly runtime: {
    readonly kind: "code" | "mastra";
    readonly version: string;
    readonly nodeMajor: number;
    readonly engineVersion?: string;
    readonly storageVersion?: string;
  };
  readonly config: JsonObject;
  readonly bindings?: RunBindings;
  readonly outcome?: LoomManifest["outcome"];
}
export interface RunRecord {
  readonly recoveredKernelVersion?: string;
  readonly result?: OutcomeProjection;
  readonly view: RunView;
  readonly input: JsonValue;
  readonly inputFiles?: readonly string[];
  readonly binding: RunBinding;
  readonly stoppingWithActivity?: boolean;
  readonly checkpoint?: CheckpointRecord;
  readonly waits?: readonly WaitRecord[];
  readonly interactions?: readonly {
    readonly request: InteractionRequest;
    readonly responses: readonly InteractionResponseRecord[];
  }[];
  readonly children?: readonly {
    readonly callId: string;
    readonly childRunId: string;
  }[];
}
export interface RunOperation {
  readonly id: string;
  readonly runId: string;
  readonly operation: "start" | "resume" | "cancel";
  readonly time: string;
  readonly reason?: string;
  readonly source?: ResponseSource;
  readonly waitId?: string;
  readonly responseId?: string;
  readonly checkpointId?: string;
}
export type EventInput = RunEventInput;
export interface ActivitySnapshot {
  readonly record: RunRecord;
  readonly events: readonly RunEvent[];
  readonly artifacts: readonly ArtifactRecord[];
}
export interface RunListQuery {
  readonly after?: string | undefined;
  readonly limit: number;
  readonly status?: RunStatus | undefined;
  readonly loom?: LoomSelector | undefined;
  readonly unfinished?: boolean;
  readonly parentRunId?: string | undefined;
}
export interface RunRepository extends OutcomeRepository {
  get(id: string): Promise<RunRecord | undefined>;
  listUnfinished(): Promise<readonly RunRecord[]>;
  findInteraction(requestId: string): Promise<RunRecord | undefined>;
  listViews(options: RunListQuery): Promise<readonly RunSummary[]>;
  save(
    record: RunRecord,
    events: readonly EventInput[],
    operation?: RunOperation,
    related?: readonly RunRecord[],
  ): Promise<void>;
  log(runId: string, event: EventInput): Promise<void>;
  events(
    runId: string,
    after?: number,
    limit?: number,
  ): Promise<readonly RunEvent[]>;
  snapshot(runId: string): Promise<ActivitySnapshot | undefined>;
  subscribe(listener: (notice: RunEventsCommitted) => void): () => void;
}
export interface WaitDescriptor {
  readonly executions: readonly ObservedExecution[];
  readonly view: RunWaitView;
  readonly definitionPath: readonly string[];
  readonly locator: JsonObject;
  readonly request?: InteractionRequest;
}
export interface ObservedExecution {
  readonly executionId: string;
  readonly parentExecutionId?: string;
  readonly kind: "workflow" | "step";
  readonly origin: import("@intloom/loom-sdk").ExecutionOrigin;
}
export interface WaitRecord extends WaitDescriptor {
  readonly consumed?: boolean;
  readonly accepted?: { readonly data?: JsonValue };
}
export interface CheckpointRecord {
  readonly id: string;
  readonly engineRef: JsonObject;
  readonly snapshotFingerprint: string;
  readonly waitIds: readonly string[];
  readonly createdAt: string;
}
export type ExecutionBoundary =
  | {
      readonly kind: "delivery-decision";
      readonly approved: boolean;
      readonly reason?: string;
    }
  | { readonly kind: "completed"; readonly output: JsonValue }
  | {
      readonly kind: "waiting";
      readonly checkpoint: CheckpointRecord;
      readonly waits: readonly WaitDescriptor[];
      readonly events?: readonly EventInput[];
    }
  | { readonly kind: "failed"; readonly error: ExecutionError }
  | { readonly kind: "cancelled" };
export type PersistedExecutionEvidence =
  | Extract<ExecutionBoundary, { kind: "completed" | "waiting" }>
  | { readonly kind: "unsettled" | "missing" };
export interface AcceptedResume {
  readonly wait: WaitRecord;
  readonly data?: JsonValue;
  readonly checkpoint: CheckpointRecord;
}
export interface RunServices {
  bindEnvironment(
    harness: "mastra" | "opencode" | undefined,
    bindings: RunBindings,
  ): Promise<void>;
  recordEvent(event: EventInput): Promise<void>;
  outcomes(
    scope: ExecutionScope,
  ): Pick<RuntimeContext, "artifacts" | "acceptance">;
  id(): string;
  now(): string;
  child(
    callId: string,
    loom: InstalledLoomRef | (() => Promise<InstalledLoomRef>),
    input: unknown,
    scope: ExecutionScope,
  ): Promise<RunView>;
}
export interface RunExecution {
  start(input: JsonValue): Promise<ExecutionBoundary>;
  resume(input: AcceptedResume): Promise<ExecutionBoundary>;
  cancel(): Promise<void>;
  release(): Promise<void>;
}
export interface LoomRuntime {
  prepare(
    ref: InstalledLoomRef,
    projectDir?: string,
  ): Promise<{
    readonly binding: RunBinding;
    normalize(input: unknown): JsonValue;
  }>;
  inspect(record: RunRecord): Promise<PersistedExecutionEvidence>;
  check(record: RunRecord): Promise<void>;
  normalizeResume(
    record: RunRecord,
    wait: WaitRecord,
    input: unknown,
  ): Promise<JsonValue | undefined>;
  init(
    record: RunRecord,
    log: (event: EventInput) => void,
    stop: (error: ExecutionError) => Promise<void>,
    services: RunServices,
  ): Promise<RunExecution>;
}
