import type { LoomError } from "@intloom/utils";
import type { LoomConfig } from "../core/schemas/loom-config.ts";
import type { AgentId } from "./blueprint.ts";
import type { AgentSpec, WorkflowModule } from "./module.ts";
import type { WorkflowRegistries } from "./registries.ts";

export interface WorkflowPackage {
  readonly packageName: string;
  readonly packageVersion: string;
  /** The intloom.version field in package.json, managed independently of the npm package version. */
  readonly protocolVersion: string;
  readonly packageRoot: string;
  /** Absolute file URL resolved through package exports, used for import. */
  readonly entryUrl: string;
  /** Absolute directory containing the generated entry; typically dist locally and the package root after installation. */
  readonly assetRoot: string;
}

export interface LoadedWorkflow extends WorkflowModule {
  readonly source: WorkflowPackage;
}

export interface InitializeWorkflowsOptions {
  readonly projectRoot: string;
  /** Validated by the configuration loader; the Workflow module does not reload configuration files. */
  readonly config: LoomConfig;
}

/** Validated resources, independent of model configuration and credentials. */
export interface LoadedAgent {
  readonly agentId: AgentId;
  readonly spec: AgentSpec;
  readonly source: WorkflowPackage;
}

export type WorkflowInitializationPhase =
  | "discover"
  | "load"
  | "agent"
  | "register";

/** flowName may be unavailable before loading; failures are always recorded by dependency package name. */
export interface WorkflowInitializationFailure {
  readonly packageName: string;
  readonly flowName?: string;
  readonly isAvailable: false;
  readonly phase: WorkflowInitializationPhase;
  readonly error: LoomError;
}

export type WorkflowInitializationOutcome =
  | {
      readonly packageName: string;
      readonly flowName: string;
      readonly isAvailable: true;
    }
  | WorkflowInitializationFailure;

export interface WorkflowDiscoveryResult {
  readonly sources: readonly WorkflowPackage[];
  readonly failures: readonly WorkflowInitializationFailure[];
}

export interface WorkflowInitializationResult {
  /** Contains only fully initialized Workflows; failed packages contribute no registered resources. */
  readonly registries: WorkflowRegistries;
  readonly workflows: readonly WorkflowInitializationOutcome[];
}
