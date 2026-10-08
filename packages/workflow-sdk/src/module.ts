import type { ZodType } from "zod";
import type { AgentId, Blueprint, CodeId } from "./blueprint.ts";
import type { ExecutableCode } from "./execution.ts";
import type { JsonValue } from "./json.ts";
import type { AgentTool } from "./agent-tool.ts";

export interface SkillSpec {
  readonly name: string;
  readonly description: string;
  readonly content: string;
  /** Relative to the compiled entry directory, including after package installation. */
  readonly assets: readonly string[];
}

export interface AgentSpec {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly llm: string;
  readonly outputSchema: ZodType<JsonValue>;
  readonly skills: readonly SkillSpec[];
  readonly tools: readonly AgentTool[];
}

export interface WorkflowModule {
  readonly blueprint: Blueprint;
  readonly codes: Readonly<Record<CodeId, ExecutableCode>>;
  readonly agentSpecs: Readonly<Record<AgentId, AgentSpec>>;
}
