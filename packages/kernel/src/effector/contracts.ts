import type { JsonValue, ReadonlyJsonValue } from "../shared/json.ts";
import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
  ExecutableAgent,
  ExecutableCode,
  StepResult,
} from "./execution.ts";

export interface Effector {
  executeCode(
    code: ExecutableCode,
    input: ReadonlyJsonValue,
    access: CodeExecutionAccess<JsonValue>,
  ): Promise<StepResult>;

  executeAgent(
    agent: ExecutableAgent,
    input: ReadonlyJsonValue,
    access: AgentExecutionAccess<JsonValue>,
  ): Promise<StepResult>;
}
