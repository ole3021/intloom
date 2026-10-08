import { LoomError } from "@intloom/utils";

export type WorkflowInitializationErrorCode =
  | "INVALID_WORKFLOW_PACKAGE"
  | "UNSUPPORTED_WORKFLOW_PROTOCOL"
  | "INVALID_WORKFLOW"
  | "WORKFLOW_LOAD_FAILED"
  | "WORKFLOW_AGENT_FAILED"
  | "WORKFLOW_REGISTRATION_FAILED"
  | "WORKFLOW_CONFLICT";

/** Preserves the underlying cause; diagnostics contain package locations and definition paths, never model credentials. */
export function fail(
  code: WorkflowInitializationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new LoomError(code, message, { cause });
}

/** Normalizes unknown errors while preserving an existing LoomError's code, message, and cause. */
export function workflowError(
  cause: unknown,
  code: WorkflowInitializationErrorCode,
  message: string,
): LoomError {
  return LoomError.is(cause) ? cause : new LoomError(code, message, { cause });
}
