import type { ZodType } from "zod";
import type { AgentExecutionAccess } from "./execution.ts";
import type { JsonValue } from "./json.ts";

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
