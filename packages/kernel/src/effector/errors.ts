import type * as z from "zod";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import {
  RUNTIME_ERRORS,
  type RuntimeError,
  type RuntimeErrorCode,
} from "../errors/runtime.ts";

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

/** Keeps a Tool's own external-service errors distinct from Kernel model request failures. */
export function toolError(cause: unknown, toolName?: string): RuntimeError {
  const chain = causeChain(cause);
  const classified = classifiedError(chain, cause);
  if (classified) return classified;
  const name =
    toolName && /^[a-zA-Z0-9_.:-]{1,128}$/u.test(toolName)
      ? `Tool "${toolName}". `
      : "";
  const dependency = chain.find(KERNEL_ERRORS.is);
  return withDetail(
    "TOOL_EXECUTION_FAILED",
    cause,
    `${name}${dependency ? `Dependency error: ${dependency.code}. ` : ""}`,
  );
}

export function resultError(
  code: "AGENT_OUTPUT_INVALID" | "STEP_RESULT_INVALID",
  cause: z.ZodError,
): RuntimeError {
  const paths = cause.issues.slice(0, 3).map((issue) => {
    const path = issue.path;
    const printable =
      path.length <= 8 &&
      path.every(
        (part) =>
          (typeof part === "string" && /^[a-zA-Z0-9_-]{1,64}$/u.test(part)) ||
          (typeof part === "number" && Number.isSafeInteger(part) && part >= 0),
      );
    return `${printable && path.length ? path.join(".") : "root"} (${issue.code})`;
  });
  return withDetail(code, cause, `Validation path: ${paths.join(", ")}. `);
}
