import type {
  AgentExecutionAccess,
  ExecutableAgent,
  StepResult,
} from "./execution.ts";
import type { JsonValue, ReadonlyJsonValue } from "../shared/json.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { resultError } from "./errors.ts";
import { stepResultSchema } from "./schemas/step-result.ts";

/** Dispatches a prepared implementation without knowing its model framework. */
export async function executeAgent(
  agent: ExecutableAgent,
  input: ReadonlyJsonValue,
  access: AgentExecutionAccess<JsonValue>,
  maxSteps: number,
): Promise<StepResult> {
  access.signal.throwIfAborted();
  if (input !== null)
    throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
      message:
        "Agent execution receives null input; business data belongs in Stage State.",
    });
  try {
    const output = await agent.execute(input, access, maxSteps);
    access.signal.throwIfAborted();
    const parsed = await agent.outputSchema.safeParseAsync(output);
    access.signal.throwIfAborted();
    if (!parsed.success)
      throw resultError("AGENT_OUTPUT_INVALID", parsed.error);
    const result = stepResultSchema.safeParse(parsed.data);
    if (!result.success) throw resultError("STEP_RESULT_INVALID", result.error);
    return result.data;
  } catch (cause) {
    access.signal.throwIfAborted();
    throw RUNTIME_ERRORS.is(cause)
      ? cause
      : RUNTIME_ERRORS.wrap("STEP_EXECUTION_FAILED", cause);
  }
}
