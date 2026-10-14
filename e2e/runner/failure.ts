import { E2eError, type Run } from "./contracts.ts";

export function runFailure(run: Run | null | undefined) {
  if (run?.status !== "failed" || !run.lastError) return undefined;
  return new E2eError(
    run.lastError.code,
    run.lastError.message,
    [
      "LLM_REQUEST_FAILED",
      "LLM_RESPONSE_INVALID",
      "AGENT_OUTPUT_INVALID",
    ].includes(run.lastError.code)
      ? "model"
      : "system",
  );
}
export function preferRunFailure(cause: E2eError, run: Run | undefined) {
  if (
    ![
      "MODEL_OUTPUT_INVALID",
      "MODEL_EXECUTION_INCOMPLETE",
      "MODEL_REQUEST_FAILED",
      "MODEL_TRANSPORT_FAILED",
      "MODEL_STREAM_INCOMPLETE",
      "USER_BLOCKED",
    ].includes(cause.code)
  )
    return { primary: cause, secondary: undefined };
  const primary =
    run?.lastError?.code === "RUN_INTERRUPTED" ? undefined : runFailure(run);
  return { primary: primary ?? cause, secondary: primary ? cause : undefined };
}
