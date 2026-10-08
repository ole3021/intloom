import type { RunExecution, RunSource } from "../runtime/execution-policy.ts";
import type { Blueprint } from "../workflow/blueprint.ts";
import type { Effector } from "../effector/contracts.ts";
import type { Logger } from "@intloom/utils";
import type { Runtime } from "../runtime/contracts.ts";
import type { StorageAccess } from "../storage/contracts.ts";
import type {
  WorkflowInitializationPhase,
  WorkflowInitializationOutcome,
} from "../workflow/types.ts";
import type { WorkflowRegistries } from "../workflow/registries.ts";
import type { RunErrorView } from "../runtime/run-view.ts";

/** The host creates and owns resources; initialization borrows access without closing or replacing them. */
export interface InitializeProjectOptions {
  /** Host-owned recovery copies; memory remains authoritative until this process exits. */
  readonly runtimeDirectory?: string;
  readonly logger?: Logger;
  readonly signal?: AbortSignal;
  readonly effector: Effector;
  readonly storage: StorageAccess;
}

/** Project resource references retained by the host; not a Kernel instance or another Run/Stage state store. */
export interface ProjectExecution {
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
  readonly registries: WorkflowRegistries;
  readonly runtime: Runtime;
  /** In-process initialization diagnostics; cross-client presentation uses listWorkflows error projections. */
  readonly workflows: readonly WorkflowInitializationOutcome[];
}

export interface ExecutionReadiness extends RunExecution {
  /** Local prerequisites only; no model request or remote availability check. */
  readonly status: "available" | "configuration_required" | "unavailable";
  readonly error?: RunErrorView;
}

export type WorkflowView =
  | {
      readonly packageName: string;
      readonly flowName: string;
      readonly isAvailable: true;
      readonly readiness?: ExecutionReadiness;
    }
  | {
      readonly packageName: string;
      readonly flowName?: string;
      readonly isAvailable: false;
      readonly phase: WorkflowInitializationPhase;
      readonly error: RunErrorView;
    };
