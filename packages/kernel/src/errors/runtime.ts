import {
  defineErrorCatalog,
  type ErrorDefinition,
  type LoomError,
} from "@intloom/utils";

export const RUNTIME_ERROR_DEFINITIONS = {
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
  RUNTIME_NOT_IMPLEMENTED: {
    message: "The Runtime operation is not implemented.",
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
} as const satisfies Readonly<Record<string, ErrorDefinition>>;

export type RuntimeErrorCode = keyof typeof RUNTIME_ERROR_DEFINITIONS;

export type RuntimeError = LoomError<RuntimeErrorCode>;

export const RUNTIME_ERRORS = defineErrorCatalog(RUNTIME_ERROR_DEFINITIONS);
