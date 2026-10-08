import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  TypeValidationError,
} from "@ai-sdk/provider";
import { MastraError } from "@mastra/core/error";
import { LoomError } from "@intloom/utils";
import {
  RUNTIME_ERRORS,
  type RuntimeError,
  type RuntimeErrorCode,
} from "../../errors/runtime.ts";

function causeChain(cause: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = cause;
  // The SDK may wrap errors; inspect only a bounded cause chain without expanding requests, responses, or arbitrary details.
  while (chain.length < 8 && !chain.includes(current)) {
    chain.push(current);
    if (!current || typeof current !== "object" || !("cause" in current)) break;
    current = current.cause;
  }
  return chain;
}

function classifiedError(chain: unknown[], cause: unknown) {
  const error = chain.find(RUNTIME_ERRORS.is);
  if (!error) return undefined;
  return error === cause
    ? error
    : RUNTIME_ERRORS.wrap(error.code, cause, {
        message: error.message,
        retryable: error.retryable,
      });
}

function withDetail(
  code: RuntimeErrorCode,
  cause: unknown,
  detail: string,
): RuntimeError {
  return RUNTIME_ERRORS.wrap(code, cause, {
    message: `${detail}${RUNTIME_ERRORS.definitions[code].message}`,
  });
}

function responseDetail(chain: unknown[]): string {
  if (chain.some(JSONParseError.isInstance))
    return "Response is not valid JSON. ";
  if (chain.some(TypeValidationError.isInstance))
    return "Response does not match the provider protocol. ";
  if (chain.some(InvalidResponseDataError.isInstance))
    return "Provider response data is invalid. ";
  if (chain.some(EmptyResponseBodyError.isInstance))
    return "Provider response body is empty. ";
  return "";
}

/** Maps recognized model/Agent boundary errors only; a separate entry classifies Tool failures by their actual source. */
export function agentError(cause: unknown): RuntimeError {
  const chain = causeChain(cause);
  const classified = classifiedError(chain, cause);
  if (classified) return classified;
  for (const error of chain) {
    if (LoomError.is(error)) break;
    if (
      error instanceof MastraError &&
      (error.id === "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED" ||
        error.id === "STRUCTURED_OUTPUT_OBJECT_UNDEFINED")
    )
      return withDetail(
        "AGENT_OUTPUT_INVALID",
        cause,
        error.details?.value === "undefined"
          ? "No structured result object was available. "
          : "",
      );
    if (APICallError.isInstance(error)) {
      const status = error.statusCode;
      if (
        Number.isInteger(status) &&
        status !== undefined &&
        status >= 400 &&
        status <= 599
      )
        return withDetail("LLM_REQUEST_FAILED", cause, `HTTP ${status}. `);
      // Parsing failures for successful HTTP responses may be wrapped as APICallError.
      if (
        Number.isInteger(status) &&
        status !== undefined &&
        status >= 200 &&
        status <= 299
      )
        return withDetail(
          "LLM_RESPONSE_INVALID",
          cause,
          `HTTP ${status}. ${responseDetail(chain)}`,
        );
      return RUNTIME_ERRORS.wrap("LLM_REQUEST_FAILED", cause);
    }
    if (
      JSONParseError.isInstance(error) ||
      TypeValidationError.isInstance(error) ||
      InvalidResponseDataError.isInstance(error) ||
      EmptyResponseBodyError.isInstance(error)
    )
      return withDetail("LLM_RESPONSE_INVALID", cause, responseDetail(chain));
  }
  return RUNTIME_ERRORS.wrap("STEP_EXECUTION_FAILED", cause);
}
