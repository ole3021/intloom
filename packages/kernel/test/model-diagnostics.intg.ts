import assert from "node:assert/strict";

import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentExecutionOptions } from "@mastra/core/agent";

import { createTool } from "@mastra/core/tools";
import { APICallError } from "@ai-sdk/provider";
import * as z from "zod";
import { LoomError, openLog, withLogger } from "@intloom/utils";
import { executionAccess } from "./access-fixture.ts";
import { latestToolResult, scriptedAgent } from "./executor-fixture.ts";

import { createExecution } from "../src/execution/create-execution.ts";

test("rejected output diagnostics omit unknown field names and all model values", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-output-rejected-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const privateField = "privateFieldSentinel";
  const privateValue = "private-output-value-sentinel";
  const executable = scriptedAgent(() => ({
    text: JSON.stringify({
      outcome: "complete",
      changes: [],
      [privateField]: privateValue,
    }),
  }));
  await assert.rejects(
    withLogger(logs.logger, () =>
      createExecution().executeAgent(executable, null, executionAccess().agent),
    ),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  logs.flush();
  const text = await readFile(logs.filePath, "utf8");
  assert.equal(text.includes(privateField), false);
  assert.equal(text.includes(privateValue), false);
  const summary = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((row) => row.event === "agent_output_rejected");
  assert.deepEqual(summary.issueCodes, ["unrecognized_keys"]);
  assert.deepEqual(summary.knownOutputFields, ["outcome", "changes"]);
  assert.equal(summary.outputFieldCount, 3);
  assert.equal(summary.unknownOutputFieldCount, 1);
});

test("actual SDK error finish reason records bounded diagnostics without model text", async (t) => {
  const secret = "fixture-private-model-response";
  const consoleError = t.mock.method(console, "error", () => {});
  const directory = await mkdtemp(join(tmpdir(), "intloom-agent-error-log-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const executable = scriptedAgent(() => ({ text: secret, reason: "error" }));
  await assert.rejects(
    withLogger(logs.logger, () =>
      createExecution().executeAgent(executable, null, executionAccess().agent),
    ),
    (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "STEP_EXECUTION_FAILED");
      assert.ok(error.message.includes("error finish reason"));
      return true;
    },
  );
  assert.equal(executable.requests.length, 1);
  logs.flush();
  const raw = await readFile(logs.filePath, "utf8");
  assert.ok(raw.includes('"event":"agent_failed"'));
  assert.ok(raw.includes('"finishReason":"error"'));
  assert.ok(raw.includes('"modelSteps":1'));
  assert.ok(!raw.includes(secret));
  assert.equal(consoleError.mock.calls.length, 0);
});

test("actual model request failures preserve safe HTTP and transport diagnostics", async (t) => {
  const secret = "fixture-private-request-and-response";
  const directory = await mkdtemp(join(tmpdir(), "intloom-model-request-log-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const failures = [
    new APICallError({
      message: secret,
      url: `https://model.invalid/?token=${secret}`,
      requestBodyValues: { secret },
      statusCode: 403,
      responseHeaders: { authorization: secret },
      responseBody: JSON.stringify({
        error: { code: "model_not_found", message: secret },
      }),
      isRetryable: true,
    }),
    Object.assign(new Error(secret), { code: "UND_ERR_HEADERS_TIMEOUT" }),
  ];
  for (const [index, failure] of failures.entries()) {
    const executable = scriptedAgent(() => {
      throw failure;
    });
    await assert.rejects(
      withLogger(logs.logger.child({ runId: `RUN-model-${index}` }), () =>
        createExecution().executeAgent(
          executable,
          null,
          executionAccess().agent,
        ),
      ),
      (error) => {
        assert.ok(LoomError.is(error));
        assert.equal(error.code, "LLM_REQUEST_FAILED");
        assert.equal(error.retryable, false);
        assert.ok(!error.message.includes(secret));
        return true;
      },
    );
    assert.equal(executable.requests.length, 1);
  }
  logs.flush();
  const raw = await readFile(logs.filePath, "utf8");
  assert.ok(raw.includes('"httpStatus":403'));
  assert.ok(raw.includes('"providerFailureReason":"MODEL_NOT_FOUND"'));
  assert.ok(raw.includes('"transportCode":"UND_ERR_HEADERS_TIMEOUT"'));
  assert.ok(!raw.includes(secret));
});

test("actual Mastra stream errors add only observed allowlisted diagnostics", async (t) => {
  const secret = "fixture-private-stream-body-and-key";
  const directory = await mkdtemp(join(tmpdir(), "intloom-stream-error-log-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const cases = [
    new APICallError({
      message: secret,
      url: `https://model.invalid/?token=${secret}`,
      requestBodyValues: { secret },
      statusCode: 429,
      responseHeaders: { authorization: secret },
      responseBody: JSON.stringify({
        error: { code: "rate_limit_exceeded", message: secret },
      }),
      isRetryable: true,
    }),
    new Error(secret),
  ];
  for (const [index, failure] of cases.entries()) {
    const executable = scriptedAgent(() => ({ streamError: failure }));
    await assert.rejects(
      withLogger(logs.logger.child({ runId: `RUN-stream-${index}` }), () =>
        createExecution().executeAgent(
          executable,
          null,
          executionAccess().agent,
        ),
      ),
      (error) => {
        assert.ok(LoomError.is(error));
        assert.equal(error.retryable, false);
        assert.ok(!error.message.includes(secret));
        return true;
      },
    );
    assert.equal(executable.requests.length, 1);
  }
  logs.flush();
  const raw = await readFile(logs.filePath, "utf8");
  const failures = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((record) => record.event === "agent_failed");
  assert.equal(failures.length, 2);
  assert.equal(failures[0].errorCode, "LLM_REQUEST_FAILED");
  assert.equal(failures[0].observedErrorSource, "on_error");
  assert.equal(failures[0].httpStatus, 429);
  assert.equal(failures[0].providerFailureReason, "RATE_LIMIT_EXCEEDED");
  assert.equal(failures[1].errorCode, "STEP_EXECUTION_FAILED");
  assert.equal(failures[1].observedErrorSource, "on_error");
  assert.equal(failures[1].httpStatus, undefined);
  assert.equal(failures[1].providerFailureReason, undefined);
  assert.ok(!raw.includes(secret));
});

test("actual step callback logs only finite nonnegative optional token counts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-agent-usage-log-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const usages = [
    { reasoningTokens: 7, cachedInputTokens: 4 },
    { reasoningTokens: Number.POSITIVE_INFINITY, cachedInputTokens: -1 },
    {},
  ];
  for (const usage of usages) {
    await withLogger(logs.logger, () =>
      createExecution().executeAgent(
        scriptedAgent(() => ({ text: '{"outcome":"complete"}', usage })),
        null,
        executionAccess().agent,
      ),
    );
  }
  logs.flush();
  const records = (await readFile(logs.filePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((record) => record.event === "model_step_completed");
  assert.equal(records.length, 3);
  assert.equal(records[0].reasoningTokens, 7);
  assert.equal(records[0].cachedInputTokens, 4);
  for (const record of records.slice(1)) {
    assert.equal(Object.hasOwn(record, "reasoningTokens"), false);
    assert.equal(Object.hasOwn(record, "cachedInputTokens"), false);
  }
});

test("final output diagnostics distinguish cached objects without exposing model values", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-final-output-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const sentinel = "private-final-output-sentinel";
  const submit = createTool({
    id: "submit",
    description: "submit",
    inputSchema: z.strictObject({}),
    execute: async () => ({ saved: true }),
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: "" }
        : {
            text: JSON.stringify({ outcome: sentinel }),
            calls: [{ name: "submit", input: {} }],
          },
    { submit },
  );
  await assert.rejects(
    withLogger(logs.logger, () =>
      createExecution().executeAgent(executable, null, executionAccess().agent),
    ),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  logs.flush();
  const text = await readFile(logs.filePath, "utf8");
  assert.equal(text.includes(sentinel), false);
  const summary = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((row) => row.event === "agent_final_output");
  assert.equal(summary.finalTextBytes, 0);
  assert.equal(summary.finalContentTextBytes, 0);
  assert.equal(summary.structuredObjectPresent, true);
  assert.equal(summary.finishReason, "stop");
});

test("actual stream.error supplies safe fallback diagnostics without onError callback", async (t) => {
  const secret = "private-stream-fallback-sentinel";
  const directory = await mkdtemp(join(tmpdir(), "intloom-stream-fallback-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const executable = scriptedAgent(() => ({
    streamError: new APICallError({
      message: secret,
      url: "https://model.invalid",
      requestBodyValues: { secret },
      statusCode: 429,
      responseBody: JSON.stringify({
        error: { code: "rate_limit_exceeded", message: secret },
      }),
      isRetryable: true,
    }),
  }));
  const original = executable.agent.stream.bind(executable.agent);
  t.mock.method(
    executable.agent,
    "stream",
    (
      input: Parameters<typeof original>[0],
      options: AgentExecutionOptions<{ outcome: string }>,
    ) => {
      const { onError: _onError, ...rest } = options;
      return original(input, rest);
    },
  );
  await assert.rejects(
    withLogger(logs.logger, () =>
      createExecution().executeAgent(executable, null, executionAccess().agent),
    ),
    { code: "LLM_REQUEST_FAILED", retryable: false },
  );
  assert.equal(executable.requests.length, 1);
  logs.flush();
  const raw = await readFile(logs.filePath, "utf8");
  const row = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((record) => record.event === "agent_failed");
  assert.equal(row.observedErrorSource, "stream_error");
  assert.equal(row.httpStatus, 429);
  assert.equal(row.providerFailureReason, "RATE_LIMIT_EXCEEDED");
  assert.ok(!raw.includes(secret));
});
