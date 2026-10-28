import type {
  JsonValue,
  StateAccess,
  StorageAccess,
  ProjectAccess,
  InteractionAccess,
  StorageCommitResult,
} from "@intloom/loom-sdk";

export type CapabilityKind =
  | "state_read"
  | "state_write"
  | "storage_read"
  | "storage_commit"
  | "project_read"
  | "project_write"
  | "project_run"
  | "interaction";

/** Authority is live, even when its consumer retains an old Access object. */
export interface CallScope {
  readonly runId: string;
  readonly callId: string;
  readonly signal: AbortSignal;
  assertCurrent(): void;
  beginUse(capability: CapabilityKind): CapabilityUse;
}

export interface CapabilityUse {
  assertCurrent(): void;
  /** Always idempotent, including after cancellation. */
  finish(): void;
}

export interface AccessBindings {
  readonly run?: import("@intloom/loom-sdk").LoomRunContext;
  readonly scope: CallScope;
  readonly bindState: (assertCurrent: () => void) => StateAccess<JsonValue>;
  readonly storage: StorageAccess;
  readonly project?: ProjectAccess | undefined;
  readonly interaction?: InteractionAccess | undefined;
  readonly agentInteractions?: boolean;
  /** Report committed effects before checking whether their result can still be delivered. */
  readonly committed?: (result: StorageCommitResult) => void;
}
