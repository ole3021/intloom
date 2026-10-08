import type { Agent } from "@mastra/core/agent";
import type * as z from "zod";
import type { JsonValue } from "../../shared/json.ts";
import type { ExecutableAgent } from "../execution.ts";
import type { LoomConfig } from "../../core/schemas/loom-config.ts";
import type { AgentId } from "../../workflow/blueprint.ts";
import type { WorkflowPackage } from "../../workflow/types.ts";

export interface ServiceAgent extends ExecutableAgent {
  readonly agent: Agent;
  readonly outputSchema: z.ZodType<JsonValue>;
}
export interface CreateAgentOptions {
  readonly agentId: AgentId;
  readonly source: WorkflowPackage;
  readonly config: LoomConfig;
}
export interface InitializedAgent {
  readonly agentId: AgentId;
  readonly executable: ServiceAgent;
}
