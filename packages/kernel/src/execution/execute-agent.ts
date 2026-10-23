import type { AgentExecutionAccess, StepResult } from "@intloom/loom-sdk";
import type { ExecutableAgent, ServiceModelObserver } from "./execution.ts";
import type { JsonValue, ReadonlyJsonValue } from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";
import { resultError } from "./errors.ts";
import { stepResultSchema } from "@intloom/loom-sdk";
import { getLogger } from "@intloom/utils";

const outputFields = new Set([
  "outcome",
  "result",
  "output",
  "response",
  "saved",
  "status",
  "changes",
  "questions",
  "processedFeedbackCount",
  "checks",
  "type",
  "properties",
  "required",
  "additionalProperties",
  "$schema",
  "function",
  "arguments",
]);

/** Dispatches a prepared implementation without knowing its model framework. */
export async function executeAgent(
  agent: ExecutableAgent,
  input: ReadonlyJsonValue,
  access: AgentExecutionAccess<JsonValue>,
  maxSteps: number,
  observer?: ServiceModelObserver,
): Promise<StepResult> {
  access.signal.throwIfAborted();
  if (input !== null)
    throw ERRORS.create("STEP_EXECUTION_FAILED", {
      message:
        "Agent execution receives null input; business data belongs in Stage State.",
    });
  try {
    const output = await agent.execute(input, access, maxSteps, observer);
    access.signal.throwIfAborted();
    const parsed = await agent.outputSchema.safeParseAsync(output);
    access.signal.throwIfAborted();
    if (!parsed.success) {
      const keys =
        output && typeof output === "object" && !Array.isArray(output)
          ? Object.keys(output)
          : [];
      getLogger().debug("agent_output_rejected", {
        issueCodes: [
          ...new Set(parsed.error.issues.map((issue) => issue.code)),
        ],
        outputFieldCount: keys.length,
        knownOutputFields: keys.filter((key) => outputFields.has(key)),
        unknownOutputFieldCount: keys.filter((key) => !outputFields.has(key))
          .length,
      });
      throw resultError("AGENT_OUTPUT_INVALID", parsed.error);
    }
    const result = stepResultSchema.safeParse(parsed.data);
    if (!result.success) throw resultError("STEP_RESULT_INVALID", result.error);
    return result.data;
  } catch (cause) {
    access.signal.throwIfAborted();
    throw ERRORS.is(cause)
      ? cause
      : ERRORS.wrap("STEP_EXECUTION_FAILED", cause);
  }
}
