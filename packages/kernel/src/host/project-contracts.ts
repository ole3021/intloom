import type { LoomInputKind } from "@intloom/loom-sdk";
import type { RunExecution, RunSource } from "../runtime/execution-policy.ts";
import type { Blueprint } from "@intloom/loom-sdk";
import type { Execution } from "../execution/contracts.ts";
import type { Logger } from "@intloom/utils";
import type { Runtime } from "../runtime/contracts.ts";
import type { StorageAccess } from "@intloom/loom-sdk";
import type {
  LoomInitializationPhase,
  LoomInitializationOutcome,
} from "../loom/types.ts";
import type { LoomRegistries } from "../loom/registries.ts";
import type { RunErrorView } from "../runtime/run-view.ts";

/** The host creates and owns resources; initialization borrows access without closing or replacing them. */
export interface InitializeProjectOptions {
  /** Host-owned recovery copies; memory remains authoritative until this process exits. */
  readonly runtimeDirectory?: string;
  readonly observation?: import("../runtime/run-observation.ts").RuntimeObservation;
  readonly logger?: Logger;
  readonly signal?: AbortSignal;
  readonly executor: Execution;
  readonly storage: StorageAccess;
  readonly storageHandle?: import("../storage/contracts.ts").StorageHandle;
}

/** Project resource references retained by the host; not a Kernel instance or another Run/Stage state store. */
export interface ProjectExecution {
  readonly prepareExecution: (
    blueprint: Blueprint,
    source: RunSource,
  ) => Promise<RunExecution>;
  readonly executor: Execution;
  readonly projectRoot: string;
  readonly executionStatus: () => {
    readonly useMcpAgent: boolean;
    readonly serviceConfigured: boolean;
    readonly preparedServiceAgents: number;
  };
  readonly executionReadiness: (
    blueprint: Blueprint,
    source: RunSource,
  ) => ExecutionReadiness;
  readonly registries: LoomRegistries;
  readonly runtime: Runtime;
  /** In-process initialization diagnostics; cross-client presentation uses listLooms error projections. */
  readonly looms: readonly LoomInitializationOutcome[];
}

export interface ExecutionReadiness extends RunExecution {
  /** Local prerequisites only; no model request or remote availability check. */
  readonly status: "available" | "configuration_required" | "unavailable";
  readonly error?: RunErrorView;
}

export type LoomView =
  | {
      readonly packageName: string;
      readonly loomName: string;
      readonly isAvailable: true;
      readonly inputs: readonly LoomInputKind[];
      readonly readiness?: ExecutionReadiness;
    }
  | {
      readonly packageName: string;
      readonly loomName?: string;
      readonly isAvailable: false;
      readonly phase: LoomInitializationPhase;
      readonly error: RunErrorView;
    };
