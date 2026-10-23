import type { Agent } from "@mastra/core/agent";
import type * as z from "zod";
import type { JsonValue } from "@intloom/loom-sdk";
import type { ExecutableAgent } from "../execution.ts";
import type { ModelConfiguration } from "./configuration.ts";
import type { AgentId } from "@intloom/loom-sdk";
import type { LoomPackage } from "../../loom/types.ts";
import type { CredentialResolver } from "./credentials.ts";

export interface ServiceAgent extends ExecutableAgent {
  readonly agent: Agent;
  readonly outputSchema: z.ZodType<JsonValue>;
  readonly zen?: boolean;
}
export interface CreateAgentOptions {
  readonly agentId: AgentId;
  readonly source: LoomPackage;
  readonly config: ModelConfiguration;
  readonly credentials?: CredentialResolver;
}
export interface InitializedAgent {
  readonly agentId: AgentId;
  readonly executable: ServiceAgent;
}
