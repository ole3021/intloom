import type { JsonValue } from "@intloom/loom-sdk";

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

export interface ExecutionOptions {
  /** Maximum model iterations per Agent call, independent of the Loom Step count; defaults to 10. */
  readonly maxAgentSteps?: number;
  readonly serviceModelObserver?: ServiceModelObserver;
}

/** Prepared executor implementation; shared contracts do not contain framework instances. */
export interface ExecutableAgent {
  readonly outputSchema: import("zod").ZodType<JsonValue>;
  execute(
    input: import("@intloom/loom-sdk").ReadonlyJsonValue,
    access: import("@intloom/loom-sdk").AgentExecutionAccess<JsonValue>,
    maxSteps: number,
    observer?: ServiceModelObserver,
  ): Promise<unknown>;
}
