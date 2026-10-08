import type { AgentId, Blueprint, CodeId } from "./blueprint.ts";
import type { ExecutableCode } from "../effector/execution.ts";
import type { LoadedAgent, WorkflowPackage } from "./types.ts";

// #region BlueprintRegistry
/** Registered by flowName and retrieved during execution through RunState.flowName. */
export interface BlueprintRegistry {
  readonly [flowName: string]: Blueprint;
}

// #region CodeRegistry
/** Registered by globally unique CodeId; initialization rejects duplicate IDs across Workflows. */
export interface CodeRegistry {
  readonly [codeId: CodeId]: ExecutableCode;
}
// #endregion

// #region AgentRegistry
/** Stores validated resources; model instances belong to the service executor. */
export interface AgentRegistry {
  readonly [agentId: AgentId]: LoadedAgent;
}
// #endregion

export interface WorkflowRegistries {
  readonly blueprints: BlueprintRegistry;
  readonly codes: CodeRegistry;
  readonly agents: AgentRegistry;
  /** Stores sources by flowName for diagnostics and resource lookup; excluded from the Blueprint. */
  readonly sources: Readonly<Record<string, WorkflowPackage>>;
}
