import { LoomError } from "@intloom/utils";
import type { JsonValue } from "./json.ts";
import type { AgentExecutionAccess } from "./execution.ts";

export const agentExecutionContextKey = "intloom.execution";

/** Public capability access; Workflow Tools validate business Schemas, and Kernel does not infer business fields. */
export function getAgentExecutionAccess(context: {
  get(key: string): unknown;
}): AgentExecutionAccess<JsonValue> {
  try {
    const value: unknown = context.get(agentExecutionContextKey);
    if (isObject(value)) {
      const { state, storage, project, signal } = value;
      if (
        hasMethods(state, ["create", "update", "clear"]) &&
        "value" in state &&
        hasMethods(storage, [
          "getArtifact",
          "getArtifactById",
          "getLatestRecord",
          "getRecordById",
          "listArtifacts",
          "listRecords",
        ]) &&
        !("commit" in storage) &&
        !("interaction" in value) &&
        signal instanceof AbortSignal &&
        (!("project" in value) ||
          hasMethods(project, ["snapshot", "read", "write", "remove", "run"]))
      )
        return value as unknown as AgentExecutionAccess<JsonValue>;
    }
  } catch (cause) {
    throw invalidAccess(cause);
  }
  throw invalidAccess();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMethods(
  value: unknown,
  names: readonly string[],
): value is Record<string, unknown> {
  return (
    isObject(value) && names.every((name) => typeof value[name] === "function")
  );
}

function invalidAccess(cause?: unknown) {
  return new LoomError(
    "STEP_EXECUTION_FAILED",
    `Effector must bind Agent execution capabilities at ${agentExecutionContextKey}.`,
    { cause },
  );
}
