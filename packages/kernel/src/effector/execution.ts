import type { JsonValue } from "@intloom/workflow-sdk";
export type {
  CodeExecutionAccess,
  AgentExecutionAccess,
  ExecutableCode,
  StepResult,
} from "@intloom/workflow-sdk";

/** Optional host policy; no business State, model content, or provider credentials are exposed. */
export interface ServiceModelObserver {
  beforeStep(request?: { readonly requestId: string }): void | Promise<void>;
  afterStep(usage: {
    readonly requestId?: string;
    readonly modelId?: string;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  }): void | Promise<void>;
  beforeTool?(tool: { readonly toolCallId: string }): void | Promise<void>;
  afterTool?(tool: { readonly toolCallId: string }): void | Promise<void>;
}

export interface EffectorOptions {
  /** Maximum model iterations per Agent call, independent of the Workflow Step count; defaults to 10. */
  readonly maxAgentSteps?: number;
  readonly serviceModelObserver?: ServiceModelObserver;
}

/** Prepared executor implementation; shared contracts do not contain framework instances. */
export interface ExecutableAgent {
  readonly outputSchema: import("zod").ZodType<JsonValue>;
  execute(
    input: import("../shared/json.ts").ReadonlyJsonValue,
    access: import("@intloom/workflow-sdk").AgentExecutionAccess<JsonValue>,
    maxSteps: number,
    observer?: ServiceModelObserver,
  ): Promise<unknown>;
}
