import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  TypeValidationError,
} from "@ai-sdk/provider";
import { MastraError } from "@mastra/core/error";
import * as z from "zod";
import { LoomError } from "@intloom/utils";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { resultError, toolError } from "./errors.ts";
import { agentError } from "./service/errors.ts";
import { toRunView } from "../runtime/to-run-view.ts";

const privateText = "private-request-token-and-body";
function requestError(statusCode?: number) {
  return new APICallError({
    message: privateText,
    url: `https://model.invalid/?token=${privateText}`,
    requestBodyValues: { privateText },
    ...(statusCode === undefined ? {} : { statusCode }),
    responseHeaders: { authorization: privateText },
    responseBody: privateText,
    isRetryable: true,
  });
}
function sdkWrapper(cause: unknown) {
  return new MastraError(
    { id: "MODEL_CALL_FAILED", domain: "LLM", category: "THIRD_PARTY" },
    cause,
  );
}

test("HTTP and network errors expose request classification without copying SDK payloads or retry advice", () => {
  for (const status of [404, 401, 429, 503, undefined]) {
    const cause = requestError(status);
    const error = agentError(cause);
    assert.ok(LoomError.is(error));
    assert.equal(error.code, "LLM_REQUEST_FAILED");
    assert.equal(error.cause, cause);
    assert.equal(error.retryable, false);
    if (status !== undefined)
      assert.ok(error.message.includes(`HTTP ${status}`));
    assert.ok(error.message.includes("baseURL"));
    assert.ok(!error.message.includes(privateText));
    assert.equal(agentError(sdkWrapper(cause)).code, error.code);
  }
});

test("invalid provider response parsing is separate from Agent output validation", () => {
  const causes = [
    requestError(200),
    new JSONParseError({ text: privateText, cause: new Error(privateText) }),
    new TypeValidationError({
      value: privateText,
      cause: new Error(privateText),
    }),
    new InvalidResponseDataError({ data: privateText }),
    new EmptyResponseBodyError(),
  ];
  for (const cause of causes) {
    const error = agentError(sdkWrapper(cause));
    assert.equal(error.code, "LLM_RESPONSE_INVALID");
    assert.ok(!error.message.includes(privateText));
  }
  const output = new MastraError({
    id: "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED",
    domain: "AGENT",
    category: "SYSTEM",
    text: privateText,
  });
  const error = agentError(output);
  assert.equal(error.code, "AGENT_OUTPUT_INVALID");
  assert.equal(error.cause, output);
  assert.ok(error.message.includes("structuredOutput"));
  assert.ok(!error.message.includes(privateText));
  const missing = new MastraError({
    id: "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED",
    domain: "AGENT",
    category: "SYSTEM",
    details: { value: "undefined" },
  });
  assert.ok(
    agentError(missing).message.includes("No structured result object"),
  );
  assert.ok(agentError(causes[1]).message.includes("not valid JSON"));
  assert.ok(agentError(causes[2]).message.includes("provider protocol"));
  assert.ok(agentError(causes[4]).message.includes("body is empty"));
});

test("Tool source takes precedence over errors raised by a Tool's own remote dependencies", () => {
  const request = requestError(404);
  const error = toolError(request, "read_specification");
  assert.equal(error.code, "TOOL_EXECUTION_FAILED");
  assert.equal(error.cause, request);
  assert.ok(error.message.includes('Tool "read_specification"'));
  assert.ok(!error.message.includes("HTTP 404"));
  const storage = KERNEL_ERRORS.wrap("STORAGE_ERROR", new Error(privateText));
  assert.ok(toolError(storage).message.includes("STORAGE_ERROR"));
  assert.ok(!toolError(storage).message.includes(privateText));
  assert.ok(
    !toolError(request, "untrusted\nname").message.includes("untrusted"),
  );
});

test("classified Runtime errors retain code/message/retryable and unknown cycles use the safe fallback", () => {
  const original = RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
  assert.equal(agentError(original), original);
  assert.equal(toolError(original, "submit"), original);
  const wrapped = sdkWrapper(original);
  const projected = agentError(wrapped);
  assert.equal(projected.code, original.code);
  assert.equal(projected.message, original.message);
  assert.equal(projected.cause, wrapped);
  const unknown = new Error(privateText);
  unknown.cause = unknown;
  const error = agentError(unknown);
  assert.equal(error.code, "STEP_EXECUTION_FAILED");
  assert.equal(error.cause, unknown);
  assert.ok(!error.message.includes(privateText));
  assert.equal(
    agentError({ statusCode: 404, message: privateText }).code,
    "STEP_EXECUTION_FAILED",
  );
});

test("result diagnostics show Schema paths without custom messages or rejected values", () => {
  const parsed = z
    .strictObject({ outcome: z.string() })
    .safeParse({ outcome: 123 });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  for (const code of ["AGENT_OUTPUT_INVALID", "STEP_RESULT_INVALID"] as const) {
    const error = resultError(code, parsed.error);
    assert.equal(error.code, code);
    assert.equal(error.cause, parsed.error);
    assert.ok(error.message.includes("outcome (invalid_type)"));
  }
  const custom = z
    .string()
    .refine(() => false, privateText)
    .safeParse(privateText);
  assert.equal(custom.success, false);
  if (!custom.success)
    assert.ok(
      !resultError("AGENT_OUTPUT_INVALID", custom.error).message.includes(
        privateText,
      ),
    );
});

test("existing RunView carries diagnostic messages and cursor without Error internals", () => {
  const error = agentError(sdkWrapper(requestError(404)));
  const run = toRunView({
    id: "RUN-errors",
    execution: { source: "cli", agentExecutor: "service" },
    flowName: "intent",
    intent: privateText,
    cursor: { stageName: "specification", stepName: "analyze" },
    status: "failed",
    lastError: error,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.deepEqual(run.lastError, {
    code: error.code,
    message: error.message,
    retryable: false,
  });
  assert.deepEqual(run.cursor, {
    stageName: "specification",
    stepName: "analyze",
  });
  assert.ok(!JSON.stringify(run).includes(privateText));
  assert.deepEqual(Object.keys(run.lastError ?? {}).sort(), [
    "code",
    "message",
    "retryable",
  ]);
});
