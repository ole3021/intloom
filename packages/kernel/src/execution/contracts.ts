import type { JsonValue, ReadonlyJsonValue } from "@intloom/loom-sdk";
import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
  ExecutableCode,
  StepResult,
} from "@intloom/loom-sdk";
import type { ExecutableAgent } from "./execution.ts";

export interface Execution {
  readonly delegated: import("./delegated/contracts.ts").DelegatedSessions;
  recoverCode(
    code: ExecutableCode,
    saved: unknown,
    access: CodeExecutionAccess<JsonValue>,
  ): Promise<StepResult>;
  executeCode(
    code: ExecutableCode,
    access: CodeExecutionAccess<JsonValue>,
  ): Promise<StepResult>;

  executeAgent(
    agent: ExecutableAgent,
    input: ReadonlyJsonValue,
    access: AgentExecutionAccess<JsonValue>,
  ): Promise<StepResult>;
}
