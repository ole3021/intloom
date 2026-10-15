import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentExecutionOptions } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import type { PublicSchema } from "@mastra/core/schema";
import { createTool } from "@mastra/core/tools";
import { APICallError } from "@ai-sdk/provider";
import * as z from "zod";
import { LoomError, openLog, withLogger } from "@intloom/utils";
import {
  executionAccess,
  latestToolResult,
  scriptedAgent,
} from "./effector-fixture.ts";
import {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "../src/effector/agent-context.ts";
import { createEffector } from "../src/effector/create-effector.ts";
import { agentJsonSchema } from "../src/effector/agent-tool.ts";
import { deferred, runtimeFixture } from "./runtime-fixture.ts";
import { createRuntime } from "../src/runtime/create-runtime.ts";
import type { Blueprint } from "../src/workflow/blueprint.ts";
import type { AgentExecutionAccess } from "../src/effector/execution.ts";
import type { JsonValue } from "../src/shared/json.ts";

test("invalid Tool inputs can be corrected in the same Agent invocation before side effects", async () => {
  let attempts = 0;
  let executions = 0;
  const tool = createTool({
    id: "submit",
    description: "submit",
    inputSchema: z.strictObject({ value: z.number() }),
    execute: async () => {
      executions++;
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    () => {
      attempts++;
      if (attempts === 1)
        return { calls: [{ name: "submit", input: { value: "invalid" } }] };
      if (attempts === 2)
        return { calls: [{ name: "submit", input: { value: 1 } }] };
      return { text: '{"outcome":"complete"}' };
    },
    { submit: tool },
  );
  assert.deepEqual(
    await createEffector().executeAgent(
      executable,
      null,
      executionAccess().agent,
    ),
    { outcome: "complete" },
  );
  assert.equal(executions, 1);
  assert.equal(attempts, 3);
});

test("two Runs share an Agent but isolate contexts and answers across an explicit Question Code loop", async (t) => {
  const logDirectory = await mkdtemp(join(tmpdir(), "intloom-agent-log-"));
  t.after(() => rm(logDirectory, { recursive: true, force: true }));
  const log = await openLog({ directory: logDirectory });
  t.after(() => log.close());
  const stateSchema = z.strictObject({
    intent: z.string(),
    question: z.string().nullable().default(null),
    answer: z.string().nullable().default(null),
  });
  const contexts = new Set<RequestContext>();
  const snapshots: z.infer<typeof stateSchema>[] = [];
  const read = createTool({
    id: "read",
    description: "read",
    inputSchema: z.strictObject({}),
    execute: async (_input, context) => {
      contexts.add(context.requestContext);
      const state = stateSchema.parse(
        getAgentExecutionAccess(context.requestContext).state.value,
      );
      snapshots.push(state);
      return state;
    },
  });
  const submit = createTool({
    id: "submit",
    description: "submit",
    inputSchema: z.strictObject({ question: z.string() }),
    execute: async (input, context) => {
      const access = getAgentExecutionAccess(context.requestContext);
      const state = stateSchema.parse(access.state.value);
      await access.state.update({ ...state, question: input.question });
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    (request) => {
      const result = latestToolResult(request);
      if (!result) return { calls: [{ name: "read", input: {} }] };
      if (result.name === "submit")
        return { text: '{"outcome":"clarification_required"}' };
      const output = z
        .object({ type: z.literal("json"), value: stateSchema })
        .parse(result.output);
      return output.value.answer === null
        ? {
            calls: [
              {
                name: "submit",
                input: { question: `Question for ${output.value.intent}` },
              },
            ],
          }
        : { text: '{"outcome":"complete"}' };
    },
    { read, submit },
  );
  const blueprint: Blueprint = {
    flowName: "fixture",
    entryStageName: "first",
    stages: {
      first: {
        stageName: "first",
        stateSchema,
        initializeState: ({ intent }) => ({ intent }),
        entryStepName: "analyze",
        steps: {
          analyze: {
            stepName: "analyze",
            execution: { kind: "agent", agentId: "analyst" },
            on: {
              clarification_required: { kind: "step", stepName: "question" },
              complete: { kind: "stage_end" },
            },
          },
          question: {
            stepName: "question",
            execution: { kind: "code", codeId: "question" },
            on: { complete: { kind: "step", stepName: "analyze" } },
          },
        },
        on: { complete: { kind: "workflow_end" } },
      },
    },
  };
  const effects: string[] = [];
  const storage = runtimeFixture().storage;
  const runtime = createRuntime({
    storage,
    logger: log.logger,
    effector: createEffector(),
    agents: { analyst: executable },
    codes: {
      question: async (access) => {
        const state = stateSchema.parse(access.state.value);
        effects.push(state.intent);
        const answers = await access.interaction.askQuestions([
          { id: "Q1", question: state.question ?? "", isSkippable: false },
        ]);
        const answer = answers[0];
        assert.ok(answer && !answer.isSkipped);
        await access.state.update({ ...state, answer: answer.answer });
        return { outcome: "complete" };
      },
    },
  });
  t.after(() => runtime.cancelAllRuns());
  const [a, b] = await Promise.all([
    runtime.flow(blueprint, "A"),
    runtime.flow(blueprint, "B"),
  ]);
  assert.equal(a.status, "waiting");
  assert.equal(b.status, "waiting");
  assert.equal(a.cursor.stepName, "question");
  assert.ok(a.pendingAction && b.pendingAction);
  assert.equal(
    (
      await runtime.answerAsk(a.runId, a.pendingAction.id, [
        { questionId: "Q1", isSkipped: false, answer: "answer-A" },
      ])
    ).status,
    "completed",
  );
  assert.deepEqual(await runtime.getRun(b.runId), b);
  assert.equal(
    (
      await runtime.answerAsk(b.runId, b.pendingAction.id, [
        { questionId: "Q1", isSkipped: false, answer: "answer-B" },
      ])
    ).status,
    "completed",
  );
  assert.equal(contexts.size, 4);
  await log.close();
  const text = await readFile(log.filePath, "utf8");
  assert.doesNotMatch(text, /answer-A|answer-B|Question for/u);
  const rows = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  for (const runId of [a.runId, b.runId]) {
    const agentRows = rows.filter(
      (row) => row.runId === runId && row.stepName === "analyze",
    );
    assert.equal(
      agentRows.filter((row) => row.event === "agent_completed").length,
      2,
    );
    assert.ok(
      agentRows.some(
        (row) => row.event === "tool_started" && row.toolName === "read",
      ),
    );
    assert.ok(
      agentRows.some(
        (row) =>
          row.event === "tool_completed" && typeof row.durationMs === "number",
      ),
    );
    assert.ok(agentRows.some((row) => row.event === "model_step_completed"));
    assert.ok(
      agentRows.every(
        (row) =>
          row.stageName === "first" && typeof row.executionId === "number",
      ),
    );
  }
  assert.deepEqual(effects.sort(), ["A", "B"]);
  assert.deepEqual(
    snapshots
      .filter((state) => state.answer !== null)
      .sort((x, y) => x.intent.localeCompare(y.intent)),
    [
      { intent: "A", question: "Question for A", answer: "answer-A" },
      { intent: "B", question: "Question for B", answer: "answer-B" },
    ],
  );
});

test("stop cancels a live model request without allowing its late result to replace RUN_STOPPED", async () => {
  const entered = deferred<AbortSignal>();
  const release = deferred<void>();
  const aborted = deferred<void>();
  const executable = scriptedAgent(async (request) => {
    assert.ok(request.abortSignal);
    request.abortSignal.addEventListener("abort", () => aborted.resolve(), {
      once: true,
    });
    entered.resolve(request.abortSignal);
    // Simulate non-cooperative external execution that eventually returns a valid result.
    await release.promise;
    return { text: '{"outcome":"complete"}' };
  });
  const f = runtimeFixture();
  const first = {
    ...f.first,
    entryStepName: "analyze",
    steps: {
      analyze: {
        stepName: "analyze",
        execution: { kind: "agent" as const, agentId: "analyst" },
        on: { complete: { kind: "stage_end" as const } },
      },
    },
    on: { complete: { kind: "workflow_end" as const } },
  };
  const blueprint = { ...f.blueprint, stages: { first } };
  const runtime = createRuntime({
    ...f.options,
    effector: createEffector(),
    agents: { analyst: executable },
  });
  const start = runtime.flow(blueprint, "text");
  const signal = await entered.promise;
  const [running] = await runtime.listRuns();
  assert.ok(running);
  await runtime.cancelRun(running.runId);
  await aborted.promise;
  assert.equal(signal.aborted, true);
  assert.equal((await start).lastError?.code, "RUN_STOPPED");
  release.resolve();
  await setImmediate();
  assert.equal(
    (await runtime.getRun(running.runId)).lastError?.code,
    "RUN_STOPPED",
  );
});

test("ending one Code call revokes its signal but never cancels the following call", async () => {
  const f = runtimeFixture();
  let previous: AbortSignal | undefined;
  f.codes.start = (access) => {
    previous = access.signal;
    return { outcome: "complete" };
  };
  f.codes.review = (access) => {
    assert.equal(previous?.aborted, true);
    assert.equal(access.signal.aborted, false);
    assert.notEqual(access.signal, previous);
    return { outcome: "complete" };
  };
  assert.equal(
    (
      await createRuntime({ ...f.options, effector: createEffector() }).flow(
        f.blueprint,
        "text",
      )
    ).status,
    "completed",
  );
});

test("a real Agent executes business Tools serially with isolated read-only capabilities", async () => {
  const events: string[] = [];
  const contexts: RequestContext[] = [];
  let retained: AgentExecutionAccess<JsonValue> | undefined;
  const tool = (id: string) =>
    createTool({
      id,
      description: id,
      inputSchema: z.strictObject({}),
      execute: async (_input, { requestContext }) => {
        contexts.push(requestContext);
        const access = getAgentExecutionAccess(requestContext);
        retained = access;
        assert.equal("commit" in access.storage, false);
        assert.equal("interaction" in access, false);
        events.push(`${id}:start`);
        await setImmediate();
        await access.state.update({ value: id });
        events.push(`${id}:end`);
        return { saved: true };
      },
    });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}' }
        : {
            calls: [
              { name: "first", input: {} },
              { name: "second", input: {} },
            ],
          },
    { first: tool("first"), second: tool("second") },
  );
  const f = executionAccess();
  assert.deepEqual(
    await createEffector().executeAgent(executable, null, f.agent),
    { outcome: "complete" },
  );
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
  assert.deepEqual(f.state.value, { value: "second" });
  assert.equal(contexts[0], contexts[1]);
  assert.equal(contexts[0]?.has(agentExecutionContextKey), false);
  assert.equal(executable.requests.length, 2);
  assert.equal(retained?.signal.aborted, true);
  assert.throws(() => retained?.state.value, {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  assert.ok(retained);
  await assert.rejects(retained.state.update({ value: "late" }), {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
});

test("Agent execution rejects cancelled calls and non-null business input before model dispatch", async () => {
  const executable = scriptedAgent(() => ({ text: '{"outcome":"complete"}' }));
  const f = executionAccess();
  const cause = new Error("cancelled");
  f.controller.abort(cause);
  await assert.rejects(
    createEffector().executeAgent(executable, null, f.agent),
    (error) => error === cause,
  );
  await assert.rejects(
    createEffector().executeAgent(
      executable,
      { intent: "input" },
      executionAccess().agent,
    ),
    { code: "STEP_EXECUTION_FAILED" },
  );
  assert.equal(executable.requests.length, 0);
});

test("the Agent model iteration budget rejects an unfinished Tool loop without replay", async () => {
  let executions = 0;
  const tool = createTool({
    id: "again",
    description: "again",
    inputSchema: z.strictObject({}),
    execute: async () => {
      executions++;
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    () => ({ calls: [{ name: "again", input: {} }] }),
    { again: tool },
  );
  await assert.rejects(
    createEffector({ maxAgentSteps: 1 }).executeAgent(
      executable,
      null,
      executionAccess().agent,
    ),
    (error) =>
      LoomError.is(error) &&
      error.code === "STEP_EXECUTION_FAILED" &&
      error.message.includes("model-step limit"),
  );
  assert.equal(executable.requests.length, 1);
  assert.equal(executions, 1);
});

test("Agent output uses the original Zod transform once and rejects invalid outcomes", async () => {
  let parses = 0;
  const executable = scriptedAgent(() => ({
    text: '{"outcome":"  complete  "}',
  }));
  const outputSchema = z
    .strictObject({ outcome: z.string() })
    .transform((value) => {
      parses++;
      return { outcome: value.outcome.trim() };
    });
  const transformed = { ...executable, outputSchema };
  assert.deepEqual(
    await createEffector().executeAgent(
      transformed,
      null,
      executionAccess().agent,
    ),
    { outcome: "complete" },
  );
  assert.equal(parses, 1);
  const refined = {
    ...executable,
    outputSchema: z.strictObject({ outcome: z.string() }).refine(() => false),
  };
  await assert.rejects(
    createEffector().executeAgent(refined, null, executionAccess().agent),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  const invalidStep = {
    ...executable,
    outputSchema: z
      .strictObject({ outcome: z.string() })
      .transform(() => ({ outcome: "complete", output: {} })),
  };
  await assert.rejects(
    createEffector().executeAgent(invalidStep, null, executionAccess().agent),
    { code: "STEP_RESULT_INVALID" },
  );
});

test("invalid final Agent output is classified without exposing the model text", async () => {
  for (const text of [
    '{"outcome":1}',
    '{"outcome":"complete","extra":1}',
    "not json",
  ]) {
    const executable = scriptedAgent(() => ({ text }));
    await assert.rejects(
      createEffector().executeAgent(executable, null, executionAccess().agent),
      (error) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "AGENT_OUTPUT_INVALID");
        assert.equal(error.message.includes(text), false);
        return true;
      },
    );
    assert.equal(executable.requests.length, 1);
  }
});

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
      createEffector().executeAgent(executable, null, executionAccess().agent),
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

test("a Storage failure caught by a business Tool still fails the Agent invocation", async () => {
  const failure = new Error("Storage failed");
  const f = executionAccess();
  f.agent.storage.getArtifact = async () => {
    throw failure;
  };
  const read = createTool({
    id: "read",
    description: "read",
    inputSchema: z.strictObject({}),
    execute: async (_input, context) => {
      try {
        await getAgentExecutionAccess(
          context.requestContext,
        ).storage.getArtifact("fixture", "first");
      } catch {
        return { recovered: true };
      }
      return {};
    },
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}' }
        : { calls: [{ name: "read", input: {} }] },
    { read },
  );
  await assert.rejects(
    createEffector().executeAgent(executable, null, f.agent),
    (error) =>
      LoomError.is(error) &&
      error.code === "TOOL_EXECUTION_FAILED" &&
      error.cause === failure,
  );
});

test("Tool execution errors do not become successful outcomes or trigger a whole-Step retry", async () => {
  const failure = new Error("Tool failed");
  let calls = 0;
  const fail = createTool({
    id: "fail",
    description: "fail",
    inputSchema: z.strictObject({}),
    execute: async () => {
      calls++;
      throw failure;
    },
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}' }
        : { calls: [{ name: "fail", input: {} }] },
    { fail },
  );
  await assert.rejects(
    createEffector().executeAgent(executable, null, executionAccess().agent),
    (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "TOOL_EXECUTION_FAILED");
      assert.ok(error.message.includes("fail"));
      let current: unknown = error.cause;
      for (let depth = 0; depth < 4; depth++) {
        if (current === failure) return true;
        current = current instanceof Error ? current.cause : undefined;
      }
      return false;
    },
  );
  assert.equal(calls, 1);
});

test("model failures and incomplete model iterations are not reported as completion", async () => {
  const failure = new Error("model failed");
  const executable = scriptedAgent(() => {
    throw failure;
  });
  await assert.rejects(
    createEffector().executeAgent(executable, null, executionAccess().agent),
  );
  assert.equal(executable.requests.length, 1);
  await assert.rejects(
    createEffector().executeAgent(
      scriptedAgent(() => ({
        text: '{"outcome":"complete"}',
        reason: "length",
      })),
      null,
      executionAccess().agent,
    ),
    (error) =>
      LoomError.is(error) &&
      error.code === "STEP_EXECUTION_FAILED" &&
      error.message.includes("length limit"),
  );
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
      createEffector().executeAgent(executable, null, executionAccess().agent),
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
        createEffector().executeAgent(
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
        createEffector().executeAgent(
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
      createEffector().executeAgent(
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

test("Mastra structured output probe: intermediate text with a Tool is not the final outcome", async () => {
  const outputSchema = z.strictObject({ outcome: z.string() });
  const schema = agentJsonSchema(outputSchema) as PublicSchema;
  const run = (errorStrategy: "strict" | "warn") => {
    let toolCalls = 0;
    const countedTool = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: '{"outcome":"complete"}' }
          : {
              text: '{"progress":"working"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit: countedTool },
    );
    return {
      executable,
      get toolCalls() {
        return toolCalls;
      },
      generate: async () =>
        (
          await executable.agent.stream(
            "Use the Tool, then return the outcome.",
            {
              maxSteps: 3,
              toolCallConcurrency: 1,
              modelSettings: { maxRetries: 0 },
              maxProcessorRetries: 0,
              structuredOutput: {
                schema,
                errorStrategy,
                jsonPromptInjection: "auto",
              },
            },
          )
        ).getFullOutput(),
    };
  };
  const strict = run("strict");
  await assert.rejects(strict.generate(), (error) => {
    assert.ok(error instanceof Error && "id" in error);
    assert.equal(error.id, "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED");
    return true;
  });
  assert.equal(strict.executable.requests.length, 1);
  assert.equal(strict.toolCalls, 1);

  const warn = run("warn");
  const response = await warn.generate();
  assert.equal(warn.executable.requests.length, 2);
  assert.equal(warn.toolCalls, 1);
  assert.equal(response.finishReason, "stop");
  assert.equal(response.steps.at(-1)?.text, '{"outcome":"complete"}');
  assert.equal(
    outputSchema.safeParse(JSON.parse(response.steps.at(-1)?.text ?? ""))
      .success,
    true,
  );
  assert.deepEqual(response.object, { outcome: "complete" });
});

test("Mastra structured output probe: an early valid object cannot validate the final round", async () => {
  const outputSchema = z.strictObject({ outcome: z.string() });
  const schema = agentJsonSchema(outputSchema) as PublicSchema;
  for (const finalText of ['{"outcome":1}', "", '{"outcome":"complete"}']) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: finalText }
          : {
              text: '{"outcome":"premature"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit },
    );
    const stream = await executable.agent.stream(
      "Use the Tool, then return the outcome.",
      {
        maxSteps: 3,
        toolCallConcurrency: 1,
        modelSettings: { maxRetries: 0 },
        maxProcessorRetries: 0,
        structuredOutput: {
          schema,
          errorStrategy: "warn",
          jsonPromptInjection: "auto",
        },
      },
    );
    const response = await stream.getFullOutput();
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
    assert.equal(response.finishReason, "stop");
    assert.deepEqual(response.object, { outcome: "premature" });
    assert.equal(response.steps.at(-1)?.text, finalText);
    assert.equal(
      finalText.length > 0 &&
        outputSchema.safeParse(JSON.parse(finalText)).success,
      finalText === '{"outcome":"complete"}',
    );
  }
});

test("Tool-round text cannot replace the final stop outcome", async () => {
  for (const firstText of ['{"progress":"working"}', "Working on it."]) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: '```json\n{"outcome":"complete"}\n```' }
          : { text: firstText, calls: [{ name: "submit", input: {} }] },
      { submit },
    );
    assert.deepEqual(
      await createEffector().executeAgent(
        executable,
        null,
        executionAccess().agent,
      ),
      { outcome: "complete" },
    );
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
  }
});

test("host completion is isolated from business Tool IDs, validates original output once and requires an untruncated response", async () => {
  for (const reason of ["tool-calls", "length"] as const) {
    let writes = 0,
      parses = 0;
    const business = createTool({
      id: "intloom_complete_step",
      description: "An existing business Tool",
      inputSchema: z.strictObject({}),
      execute: async () => ({ saved: ++writes }),
    });
    const original = scriptedAgent(
      (request) => {
        if (writes === 0)
          return { calls: [{ name: "intloom_complete_step", input: {} }] };
        assert.ok(
          request.tools?.some(
            (tool) => tool.name === "intloom_complete_step_1",
          ),
        );
        return {
          reason,
          calls: [
            { name: "intloom_complete_step_1", input: { outcome: "complete" } },
          ],
        };
      },
      { intloom_complete_step: business },
    );
    const executable = {
      ...original,
      outputSchema: z
        .strictObject({ outcome: z.literal("complete") })
        .transform((value) => {
          parses++;
          return value;
        }),
    };
    const result = createEffector().executeAgent(
      executable,
      null,
      executionAccess().agent,
    );
    if (reason === "length")
      await assert.rejects(result, { code: "STEP_EXECUTION_FAILED" });
    else assert.deepEqual(await result, { outcome: "complete" });
    assert.equal(writes, 1);
    assert.equal(parses, reason === "length" ? 0 : 1);
    assert.equal(original.requests.length, 2);
  }
});

test("invalid host completion is a fatal Agent output error without another model request", async () => {
  const original = scriptedAgent(() => ({
    calls: [{ name: "intloom_complete_step", input: { outcome: "invented" } }],
  }));
  const executable = {
    ...original,
    outputSchema: z.strictObject({ outcome: z.literal("complete") }),
  };
  await assert.rejects(
    createEffector().executeAgent(executable, null, executionAccess().agent),
    { code: "AGENT_OUTPUT_INVALID" },
  );
  assert.equal(original.requests.length, 1);
});

test("a Tool-round outcome cannot authorize an invalid or empty final stop response", async () => {
  for (const finalText of [
    '{"outcome":1}',
    "",
    "not json",
    'Saved the current draft.\n{"outcome":"complete"}',
    'Saved the current draft.\n```json\n{"outcome":"complete"}\n```',
    '{"outcome":"premature"}\n{"outcome":"complete"}',
    '{"outcome":"complete"}',
  ]) {
    let toolCalls = 0;
    const submit = createTool({
      id: "submit",
      description: "submit",
      inputSchema: z.strictObject({}),
      execute: async () => {
        toolCalls++;
        return { saved: true };
      },
    });
    const executable = scriptedAgent(
      (request) =>
        latestToolResult(request)
          ? { text: finalText }
          : {
              text: '{"outcome":"premature"}',
              calls: [{ name: "submit", input: {} }],
            },
      { submit },
    );
    const promise = createEffector().executeAgent(
      executable,
      null,
      executionAccess().agent,
    );
    if (
      finalText === '{"outcome":"complete"}' ||
      finalText.startsWith("Saved the current draft.")
    )
      assert.deepEqual(await promise, { outcome: "complete" });
    else await assert.rejects(promise, { code: "AGENT_OUTPUT_INVALID" });
    assert.equal(executable.requests.length, 2);
    assert.equal(toolCalls, 1);
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
      createEffector().executeAgent(executable, null, executionAccess().agent),
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

test("a final non-stop response cannot reuse an earlier Tool-round outcome", async () => {
  let toolCalls = 0;
  const submit = createTool({
    id: "submit",
    description: "submit",
    inputSchema: z.strictObject({}),
    execute: async () => {
      toolCalls++;
      return { saved: true };
    },
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}', reason: "length" }
        : {
            text: '{"outcome":"premature"}',
            calls: [{ name: "submit", input: {} }],
          },
    { submit },
  );
  await assert.rejects(
    createEffector().executeAgent(executable, null, executionAccess().agent),
    { code: "STEP_EXECUTION_FAILED" },
  );
  assert.equal(executable.requests.length, 2);
  assert.equal(toolCalls, 1);
});

test("host model observer gates each actual request without replaying a Tool", async () => {
  let beforeCalls = 0;
  const usage: unknown[] = [];
  const executable = scriptedAgent(() => ({ text: '{"outcome":"complete"}' }));
  assert.deepEqual(
    await createEffector({
      serviceModelObserver: {
        beforeStep() {
          beforeCalls++;
        },
        afterStep(value) {
          usage.push(value);
        },
      },
    }).executeAgent(executable, null, executionAccess().agent),
    { outcome: "complete" },
  );
  assert.equal(beforeCalls, 1);
  assert.equal(executable.requests.length, 1);
  assert.equal(usage.length, 1);
  const blocked = scriptedAgent(() => ({ text: '{"outcome":"complete"}' }));
  await assert.rejects(
    createEffector({
      serviceModelObserver: {
        beforeStep() {
          throw new LoomError("RUN_STOPPED", "host policy");
        },
        afterStep() {
          assert.fail();
        },
      },
    }).executeAgent(blocked, null, executionAccess().agent),
  );
  assert.equal(blocked.requests.length, 0);
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
      createEffector().executeAgent(executable, null, executionAccess().agent),
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
