import {
  isLoomError,
  LoomError,
  defineErrorCatalog,
  type ErrorDefinition,
} from "@intloom/utils";
import type { RunErrorView } from "./runtime/run-view.ts";
import { ZodError } from "zod";

export function failure(
  code: string,
  message: string,
  cause?: unknown,
  retryable = false,
) {
  return new LoomError(code, message, {
    retryable,
    ...(cause === undefined ? {} : { cause }),
  });
}

/** Transport and terminal use flat error projections without exposing in-process causes, stacks, or credentials. */
export function errorView(error: unknown): RunErrorView {
  if (error instanceof ZodError)
    return {
      code: "INVALID_REQUEST",
      message: "The request or response has an invalid shape.",
      retryable: false,
    };
  return isLoomError(error)
    ? { code: error.code, message: error.message, retryable: error.retryable }
    : {
        code: "KERNEL_INTERNAL_ERROR",
        message: "The local operation failed.",
        retryable: false,
      };
}

export const ERROR_DEFINITIONS = {
  INVALID_REQUEST: {
    message: "The request is invalid.",
    retryable: false,
  },
  NOT_FOUND: {
    message: "The requested resource was not found.",
    retryable: false,
  },
  CONFLICT: {
    message: "The request conflicts with the current state.",
    retryable: false,
  },
  BUSY: {
    message: "The requested resource is busy.",
    retryable: true,
  },
  STORAGE_ERROR: {
    message: "The storage operation failed.",
    retryable: false,
  },
  KERNEL_UNAVAILABLE: {
    message: "The kernel is unavailable.",
    retryable: true,
  },

  RUN_CHECKPOINT_FAILED: {
    message:
      "The Run recovery checkpoint could not be saved. Execution cannot safely continue.",
    retryable: false,
  },
  RUN_INTERRUPTED: {
    message:
      "Execution was interrupted with an uncertain outcome. Inspect committed effects before starting new work.",
    retryable: false,
  },
  STAGE_STATE_INVALID: {
    message: "The Stage State must satisfy its Schema and JSON boundary.",
    retryable: false,
  },
  STAGE_STATE_EXISTS: {
    message: "The Stage State already exists.",
    retryable: false,
  },
  STAGE_STATE_NOT_FOUND: {
    message: "The Stage State does not exist.",
    retryable: false,
  },
  STAGE_STATE_INACTIVE: {
    message: "The Stage State access is no longer writable or active.",
    retryable: false,
  },
  RUN_STATE_INVALID: {
    message: "The Run state violates its invariants.",
    retryable: false,
  },
  RUN_INITIALIZATION_FAILED: {
    message: "The Run initialization failed.",
    retryable: false,
  },
  RUN_STOPPED: {
    message: "The Run was stopped.",
    retryable: false,
  },
  INVALID_CURSOR: {
    message: "The cursor does not identify an executable step.",
    retryable: false,
  },
  INVALID_TRANSITION: {
    message: "The transition does not identify a valid next target.",
    retryable: false,
  },
  EXECUTION_OWNERSHIP_LOST: {
    message: "The result no longer belongs to the current execution.",
    retryable: false,
  },
  STEP_OUTCOME_NOT_HANDLED: {
    message: "No transition handles the step outcome.",
    retryable: false,
  },
  STEP_EXECUTION_FAILED: {
    message: "The step execution failed.",
    retryable: false,
  },
  LLM_REQUEST_FAILED: {
    message:
      "The model service request failed. Check the llms baseURL, API path, credentials, and service availability.",
    retryable: false,
  },
  LLM_RESPONSE_INVALID: {
    message:
      "The model service response could not be parsed or validated. Check the provider protocol and response format.",
    retryable: false,
  },
  AGENT_OUTPUT_INVALID: {
    message:
      "The Agent structured output failed validation. Check the model response format and structuredOutput configuration.",
    retryable: false,
  },
  TOOL_EXECUTION_FAILED: {
    message:
      "The Agent Tool execution failed. Check the Tool implementation and dependencies.",
    retryable: false,
  },
  STEP_RESULT_INVALID: {
    message:
      "The step returned an invalid result. Return only an object with a non-empty outcome string.",
    retryable: false,
  },
  STEP_INTERACTION_INVALID: {
    message: "The step violates the interaction protocol.",
    retryable: false,
  },
  CAPABILITY_DENIED: {
    message: "The capability is not available in the current call.",
    retryable: false,
  },
  CALL_UNSETTLED: {
    message: "The call returned while capability uses were still running.",
    retryable: false,
  },
  CHECKPOINT_INVALID: {
    message: "The recovery checkpoint is invalid. Preserve it for inspection.",
    retryable: false,
  },
  RECOVERY_INCOMPATIBLE: {
    message: "The saved Run does not match the loaded Loom.",
    retryable: false,
  },
  KERNEL_INTERNAL_ERROR: {
    message: "The local operation failed.",
    retryable: false,
  },
} as const satisfies Readonly<Record<string, ErrorDefinition>>;
export const ERRORS = defineErrorCatalog(ERROR_DEFINITIONS);
export type KernelErrorCode = keyof typeof ERROR_DEFINITIONS;
export type KernelError = LoomError<KernelErrorCode>;
