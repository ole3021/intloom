import type { JsonValue } from "@intloom/workflow-sdk";
export type {
  CodeExecutionAccess,
  AgentExecutionAccess,
  ExecutableCode,
  StepResult,
} from "@intloom/workflow-sdk";

export interface EffectorOptions {
  /** Maximum model iterations per Agent call, independent of the Workflow Step count; defaults to 10. */
  readonly maxAgentSteps?: number;
}

/** Prepared executor implementation; shared contracts do not contain framework instances. */
export interface ExecutableAgent {
  readonly outputSchema: import("zod").ZodType<JsonValue>;
  execute(
    input: import("../shared/json.ts").ReadonlyJsonValue,
    access: import("@intloom/workflow-sdk").AgentExecutionAccess<JsonValue>,
    maxSteps: number,
  ): Promise<unknown>;
}
