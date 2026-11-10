import type {
  AgentDefinition,
  ExecutionOrigin,
  IntloomError,
  ModelBindingDescription,
  PromptContext,
  ToolDefinition,
} from "@intloom/loom-sdk";
import type { Observation } from "../execution/observation.ts";
import type { RunServices } from "../lifecycle/run-contracts.ts";

/** Capabilities supplied to one Agent invocation on its selected runtime. */
export interface AgentHarnessHost {
  readonly signal: AbortSignal;
  readonly model: ModelBindingDescription;
  readonly context: PromptContext;
  readonly observation: Pick<Observation, "fields" | "model">;
  readonly id: RunServices["id"];
  readonly recordEvent: RunServices["recordEvent"];
  credential(): Promise<string>;
  callTool(
    tool: ToolDefinition,
    input: unknown,
    origin: ExecutionOrigin,
  ): Promise<unknown>;
  fail(error: IntloomError, origin: ExecutionOrigin): Promise<void>;
}
export type RunAgent = (
  host: AgentHarnessHost,
  agent: AgentDefinition,
  input: unknown,
  origin: ExecutionOrigin,
  waiting?: () => boolean,
) => Promise<unknown>;
