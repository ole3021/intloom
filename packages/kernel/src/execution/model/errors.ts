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
  ERRORS,
  type KernelError,
  type KernelErrorCode,
} from "../../errors.ts";

function causeChain(cause: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = cause;
  // The SDK may wrap errors; inspect only a bounded cause chain without expanding requests, responses, or arbitrary details.
  while (chain.length < 8 && !chain.includes(current)) {
    chain.push(current);
    if (!current || typeof current !== "object") break;
    const next = Object.getOwnPropertyDescriptor(current, "cause");
    if (!next || !("value" in next)) break;
    current = next.value;
  }
  return chain;
}

function classifiedError(chain: unknown[], cause: unknown) {
  const error = chain.find(ERRORS.is);
  if (!error) return undefined;
  return error === cause
    ? error
    : ERRORS.wrap(error.code, cause, {
        message: error.message,
        retryable: error.retryable,
      });
}

function withDetail(
  code: KernelErrorCode,
  cause: unknown,
  detail: string,
): KernelError {
  return ERRORS.wrap(code, cause, {
    message: `${detail}${ERRORS.definitions[code].message}`,
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

const sdkErrorIds = new Set([
  "AGENT_GENERATE_FAILED",
  "AGENT_STREAM_ERROR",
  "STRUCTURED_OUTPUT_OBJECT_UNDEFINED",
  "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED",
]);

export type ProviderFailureReason =
  | "CONTEXT_LENGTH_EXCEEDED"
  | "INVALID_API_KEY"
  | "INSUFFICIENT_QUOTA"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "MODEL_ACCESS_DISABLED";

const providerCodes: Readonly<Record<string, ProviderFailureReason>> = {
  context_length_exceeded: "CONTEXT_LENGTH_EXCEEDED",
  invalid_api_key: "INVALID_API_KEY",
  insufficient_quota: "INSUFFICIENT_QUOTA",
  model_not_found: "MODEL_NOT_FOUND",
  rate_limit_exceeded: "RATE_LIMIT_EXCEEDED",
};

const providerFailureDetails: Readonly<Record<ProviderFailureReason, string>> =
  {
    CONTEXT_LENGTH_EXCEEDED:
      "Provider rejected the request context length. Reduce the context or use a model with a larger limit. ",
    INVALID_API_KEY:
      "Provider rejected the API key. Check the configured credential and workspace access. ",
    INSUFFICIENT_QUOTA:
      "Provider reports insufficient quota. Check account quota and billing. ",
    MODEL_NOT_FOUND:
      "Provider could not find the requested model. Check the model ID and availability. ",
    RATE_LIMIT_EXCEEDED:
      "Provider rate limit was reached. Check account rate limits and existing Run effects. ",
    MODEL_ACCESS_DISABLED:
      "Provider reports that model access is disabled. Check model availability and workspace access. ",
  };

function providerFailureReason(
  error: APICallError,
): ProviderFailureReason | undefined {
  const body = Object.getOwnPropertyDescriptor(error, "responseBody")?.value;
  if (
    typeof body !== "string" ||
    body.length > 8192 ||
    Buffer.byteLength(body, "utf8") > 8192
  )
    return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return undefined;
    const issue = Object.getOwnPropertyDescriptor(parsed, "error")?.value;
    if (!issue || typeof issue !== "object" || Array.isArray(issue))
      return undefined;
    const code = Object.getOwnPropertyDescriptor(issue, "code")?.value;
    if (typeof code === "string" && Object.hasOwn(providerCodes, code))
      return providerCodes[code];
    const message = Object.getOwnPropertyDescriptor(issue, "message")?.value;
    if (
      error.statusCode === 403 &&
      (message === "Upstream request failed: Model access is disabled" ||
        message === "Model access is disabled")
    )
      return "MODEL_ACCESS_DISABLED";
  } catch {
    // Unknown or malformed provider data remains unclassified.
  }
  return undefined;
}

const transportCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function transportCode(chain: unknown[]): string | undefined {
  for (const error of chain) {
    if (!(error instanceof Error)) continue;
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (typeof code === "string" && transportCodes.has(code)) return code;
  }
  return undefined;
}

/** Only named SDK fields and recognized transport codes may enter execution logs. */
export function modelErrorDiagnostics(cause: unknown) {
  const chain = causeChain(cause);
  const sdkError = chain.find((error) => error instanceof MastraError);
  const requestError = chain.find(APICallError.isInstance);
  const httpStatus = requestError?.statusCode;
  const transport = transportCode(chain);
  const reason = requestError && providerFailureReason(requestError);
  return {
    ...(sdkError instanceof MastraError && sdkErrorIds.has(sdkError.id)
      ? { sdkErrorId: sdkError.id }
      : {}),
    ...(Number.isInteger(httpStatus) &&
    httpStatus !== undefined &&
    httpStatus >= 100 &&
    httpStatus <= 599
      ? { httpStatus }
      : {}),
    ...(transport ? { transportCode: transport } : {}),
    ...(reason ? { providerFailureReason: reason } : {}),
  };
}

export function incompleteAgentError(
  reason: string | undefined,
  cause?: unknown,
  exhaustedSteps = false,
): KernelError {
  const detail =
    reason === "length"
      ? "Model output stopped at its length limit. Check the model output limit or reduce the requested scope. "
      : exhaustedSteps && reason === "tool-calls"
        ? "The Agent reached its model-step limit before a final response. "
        : reason === "error"
          ? "Model execution ended with an error finish reason. "
          : "Agent execution ended without a complete final response. ";
  return withDetail("STEP_EXECUTION_FAILED", cause, detail);
}

/** Maps recognized model/Agent boundary errors only; a separate entry classifies Tool failures by their actual source. */
export function agentError(cause: unknown, finishReason?: string): KernelError {
  const chain = causeChain(cause);
  const classified = classifiedError(chain, cause);
  if (classified) return classified;
  if (
    finishReason === "length" &&
    chain.some(
      (error) =>
        error instanceof MastraError &&
        (error.id === "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED" ||
          error.id === "STRUCTURED_OUTPUT_OBJECT_UNDEFINED"),
    )
  )
    return incompleteAgentError("length", cause);
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
        `${finishReason === "error" ? "Model ended with an error finish reason. " : ""}${error.details?.value === "undefined" ? "No structured result object was available. " : ""}`,
      );
    if (APICallError.isInstance(error)) {
      const status = error.statusCode;
      if (
        Number.isInteger(status) &&
        status !== undefined &&
        status >= 400 &&
        status <= 599
      ) {
        const reason = providerFailureReason(error);
        const detail = reason
          ? providerFailureDetails[reason]
          : status === 403
            ? "Check model availability and workspace access. "
            : status === 401
              ? "Check the configured credential and workspace access. "
              : status === 429
                ? "Check provider rate limits and account quota. "
                : "";
        return withDetail(
          "LLM_REQUEST_FAILED",
          cause,
          `HTTP ${status}. ${detail}`,
        );
      }
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
      return ERRORS.wrap("LLM_REQUEST_FAILED", cause);
    }
    if (
      JSONParseError.isInstance(error) ||
      TypeValidationError.isInstance(error) ||
      InvalidResponseDataError.isInstance(error) ||
      EmptyResponseBodyError.isInstance(error)
    )
      return withDetail("LLM_RESPONSE_INVALID", cause, responseDetail(chain));
  }
  const transport = transportCode(chain);
  if (transport)
    return withDetail("LLM_REQUEST_FAILED", cause, `Transport ${transport}. `);
  if (finishReason === "length" || finishReason === "error")
    return incompleteAgentError(finishReason, cause);
  return ERRORS.wrap("STEP_EXECUTION_FAILED", cause);
}
