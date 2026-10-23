import * as z from "zod";
import type { ZodType } from "zod";
import type { AgentExecutionAccess, StepResult } from "./execution.ts";
import type { JsonValue } from "./json.ts";

/** Project-wide model purposes: thinking for analysis/review, working for following instructions, coding for implementation. */
export const agentModelTypeSchema = z.enum(["thinking", "working", "coding"]);
export type AgentModelType = z.infer<typeof agentModelTypeSchema>;

/** Business Tools execute in the host with access bound to one Agent invocation. */
export interface AgentTool<
  Input = unknown,
  Output = unknown,
  RawOutput = Output,
> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: ZodType<Input>;
  readonly outputSchema: ZodType<Output, RawOutput>;
  /** Close this invocation's Tools after a validated result; a final Agent outcome is still required. */
  endsAgent?(output: NoInfer<Output>): boolean;
  execute(
    input: NoInfer<Input>,
    access: AgentExecutionAccess<JsonValue>,
  ): NoInfer<RawOutput> | Promise<NoInfer<RawOutput>>;
}

/** Preserves schema inference without constructing a framework-specific Tool. */
export function defineAgentTool<Input, Output, RawOutput = Output>(
  tool: AgentTool<Input, Output, RawOutput>,
): AgentTool<Input, Output, RawOutput> {
  return tool;
}

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
  /** Preferred project model purpose; the host uses its default when this purpose is not configured. */
  readonly llm: AgentModelType;
  readonly outputSchema: ZodType<StepResult>;
  readonly skills: readonly SkillSpec[];
  readonly tools: readonly AgentTool[];
}
