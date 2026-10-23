import type { JsonValue } from "@intloom/loom-sdk";
import { resultError } from "./errors.ts";
import { stepResultSchema } from "@intloom/loom-sdk";
import type {
  CodeExecutionAccess,
  ExecutableCode,
  StepResult,
} from "@intloom/loom-sdk";

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
