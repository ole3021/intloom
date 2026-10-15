import type { JsonValue } from "../shared/json.ts";
import { resultError } from "./errors.ts";
import { stepResultSchema } from "./schemas/step-result.ts";
import type {
  CodeExecutionAccess,
  ExecutableCode,
  StepResult,
} from "./execution.ts";

export async function executeCode(
  code: ExecutableCode,
  access: CodeExecutionAccess<JsonValue>,
): Promise<StepResult> {
  access.signal.throwIfAborted();
  const result: unknown = await code(access);
  access.signal.throwIfAborted();
  const parsed = stepResultSchema.safeParse(result);
  if (!parsed.success) throw resultError("STEP_RESULT_INVALID", parsed.error);
  return parsed.data;
}
