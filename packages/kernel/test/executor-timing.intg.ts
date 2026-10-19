import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { APICallError } from "@ai-sdk/provider";
import type { LanguageModel } from "@mastra/core/llm";
import { createTool } from "@mastra/core/tools";
import { LoomError, openLog, withLogger } from "@intloom/utils";
import * as z from "zod";
import { createExecution } from "../src/execution/create-execution.ts";
import { timeModelRequest } from "../src/execution/model/model-timing.ts";
import { getAgentExecutionAccess } from "../src/execution/agent-context.ts";
import type { ServiceModelObserver } from "../src/execution/execution.ts";
import { executionAccess } from "./access-fixture.ts";
import { latestToolResult, scriptedAgent } from "./executor-fixture.ts";
import { deferred } from "./runtime-fixture.ts";

type Row = Record<string, unknown> & { event: string };
type Model = Extract<LanguageModel, { specificationVersion: "v2" }>;
type StreamResult = Awaited<ReturnType<Model["doStream"]>>;
type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

async function logFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-executor-timing-"));
  const logs = await openLog({ directory });
  t.after(async () => {
    await logs.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    logger: logs.logger,
    async rows(): Promise<Row[]> {
      logs.flush();
      return (await readFile(logs.filePath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Row);
    },
  };
}

function duration(row: Row, field = "durationMs"): number {
  const value = row[field];
  assert.ok(typeof value === "number" && Number.isFinite(value) && value >= 0);
  return value;
}

function event(rows: Row[], name: string): Row {
  const selected = rows.filter((row) => row.event === name);
  assert.equal(selected.length, 1, name);
  const row = selected[0];
  assert.ok(row);
  return row;
}

function observerFixture() {
  const before: string[] = [];
  const after: string[] = [];
  const toolsBefore: string[] = [];
  const toolsAfter: string[] = [];
  const observer: ServiceModelObserver = {
    beforeStep(request) {
      assert.ok(request);
      before.push(request.requestId);
    },
    afterStep(usage) {
      assert.ok(usage.requestId);
      after.push(usage.requestId);
    },
    beforeTool({ toolCallId }) {
      toolsBefore.push(toolCallId);
    },
    afterTool({ toolCallId }) {
      toolsAfter.push(toolCallId);
    },
  };
  return { observer, before, after, toolsBefore, toolsAfter };
}

test("provider timing consumes finish parts, preserves private receivers and unwraps between requests", async (t) => {
  const logs = await logFixture(t);
  const first: StreamPart = { type: "stream-start", warnings: [] };
  const finish: StreamPart = {
    type: "finish",
    finishReason: "stop",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  };
  const parts = [first, finish];
  class PrivateModel implements Model {
    readonly specificationVersion = "v2";
    readonly provider = "fixture";
    readonly supportedUrls = {};
    #identity = "private-model";
    calls = 0;
    get modelId() {
      return this.#identity;
    }
    async doGenerate(): Promise<Awaited<ReturnType<Model["doGenerate"]>>> {
      throw new Error("Unexpected generate");
    }
    async doStream(
      options: Parameters<Model["doStream"]>[0],
    ): Promise<StreamResult> {
      assert.equal(this.#identity, "private-model");
      assert.deepEqual(options.headers, {
        existing: "preserved",
        "x-opencode-session": "stable-conversation",
      });
      this.calls++;
      return {
        stream: new ReadableStream<StreamPart>({
          async start(controller) {
            controller.enqueue(first);
            await delay(25);
            controller.enqueue(finish);
            controller.close();
          },
        }),
      };
    }
  }
  const model = new PrivateModel();
  let wrapped: Model = model;
  for (const modelRequestId of ["provider-first", "provider-second"]) {
    const started = performance.now();
    const timing = timeModelRequest(
      wrapped,
      new AbortController().signal,
      logs.logger,
      { modelRequestId },
      { "x-opencode-session": "stable-conversation" },
    );
    wrapped = timing.model as Model;
    const response = await wrapped.doStream({
      prompt: [],
      headers: { existing: "preserved" },
    });
    const reader = response.stream.getReader();
    const seen: StreamPart[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      seen.push(next.value);
    }
    reader.releaseLock();
    assert.deepEqual(seen, parts);
    assert.equal(seen[0], parts[0]);
    assert.equal(seen[1], parts[1]);
    const providerEnded = performance.now();
    // Delay the consumer's later completion hook; provider duration must already be closed.
    await delay(60);
    timing.report();
    timing.report();
    const completed = event(
      (await logs.rows()).filter(
        (row) => row.modelRequestId === modelRequestId,
      ),
      "model_step_completed",
    );
    assert.ok(duration(completed) >= 20);
    assert.ok(duration(completed) <= Math.round(providerEnded - started) + 5);
  }
  assert.equal(model.calls, 2);
  const rows = await logs.rows();
  assert.equal(
    rows.filter((row) => row.event === "model_step_started").length,
    2,
  );
  assert.equal(
    rows.filter((row) => row.event === "model_step_completed").length,
    2,
  );
});

test("model, Tool and Agent timings have independent boundaries and preserve transport request identity", async (t) => {
  const logs = await logFixture(t);
  const secret = "PRIVATE_MODEL_AND_TOOL_VALUE_SENTINEL";
  const observer = observerFixture();
  const submit = createTool({
    id: "submit",
    description: "Save controlled state",
    inputSchema: z.strictObject({ value: z.string() }),
    execute: async () => {
      await delay(120);
      return { saved: secret };
    },
  });
  const executable = scriptedAgent(
    async (request) => {
      await delay(8);
      return latestToolResult(request)
        ? { text: '{"outcome":"complete"}' }
        : { calls: [{ name: "submit", input: { value: secret } }] };
    },
    { submit },
  );
  const output = await withLogger(
    logs.logger.child({
      requestId: "transport-request",
      runId: "RUN-timing",
      stageName: "first",
      stepName: "analyze",
      executionId: 7,
    }),
    () =>
      createExecution({ serviceModelObserver: observer.observer }).executeAgent(
        executable,
        null,
        executionAccess().agent,
      ),
  );
  assert.deepEqual(output, { outcome: "complete" });
  assert.equal(executable.requests.length, 2);
  assert.equal(observer.before.length, 2);
  assert.deepEqual(observer.after, observer.before);
  assert.equal(new Set(observer.before).size, 2);
  assert.equal(observer.toolsBefore.length, 1);
  assert.deepEqual(observer.toolsAfter, observer.toolsBefore);

  const rows = await logs.rows();
  const started = rows.filter((row) => row.event === "model_step_started");
  const completed = rows.filter((row) => row.event === "model_step_completed");
  assert.deepEqual(
    started.map((row) => row.modelStep),
    [1, 2],
  );
  assert.deepEqual(
    completed.map((row) => row.modelRequestId),
    observer.before,
  );
  assert.deepEqual(
    started.map((row) => row.modelRequestId),
    observer.before,
  );
  assert.ok(started.every((row) => row.model === "fixture-model"));
  const toolStarted = event(rows, "tool_started");
  const toolCompleted = event(rows, "tool_completed");
  assert.equal(toolStarted.toolCallId, observer.toolsBefore[0]);
  assert.equal(toolCompleted.toolCallId, toolStarted.toolCallId);
  assert.equal(toolCompleted.modelRequestId, observer.before[0]);
  assert.equal(toolCompleted.modelStep, 1);
  assert.ok(duration(toolCompleted) >= 100);
  // SDK step completion follows Tool dispatch; the provider timing ends at its finish part.
  const firstCompleted = completed[0];
  assert.ok(firstCompleted);
  assert.ok(
    duration(firstCompleted, "stepDurationMs") - duration(firstCompleted) >=
      100,
  );
  const total = event(rows, "agent_completed");
  assert.ok(duration(total) >= duration(toolCompleted));
  assert.equal(total.modelSteps, 2);
  assert.equal(total.toolCalls, 1);
  for (const row of rows.filter((row) => row.runId === "RUN-timing")) {
    assert.equal(row.requestId, "transport-request");
    assert.equal(row.runId, "RUN-timing");
    assert.equal(row.executionId, 7);
  }
  assert.equal(JSON.stringify(rows).includes(secret), false);
});

test("concurrent executions sharing an Agent keep model and Tool IDs within their Run", async (t) => {
  const logs = await logFixture(t);
  const entered = deferred();
  let calls = 0;
  const read = createTool({
    id: "read",
    description: "Read this execution",
    inputSchema: z.strictObject({}),
    execute: async (_input, context) => {
      if (++calls === 2) entered.resolve();
      await entered.promise;
      return getAgentExecutionAccess(context.requestContext).state.value;
    },
  });
  const executable = scriptedAgent(
    (request) =>
      latestToolResult(request)
        ? { text: '{"outcome":"complete"}' }
        : { calls: [{ name: "read", input: {} }] },
    { read },
  );
  await Promise.all(
    ["A", "B"].map((marker) =>
      withLogger(
        logs.logger.child({
          runId: `RUN-${marker}`,
          requestId: `transport-${marker}`,
        }),
        () =>
          createExecution().executeAgent(
            executable,
            null,
            executionAccess({ marker }).agent,
          ),
      ),
    ),
  );
  assert.equal(executable.requests.length, 4);
  const rows = await logs.rows();
  const allIds = new Set<string>();
  for (const marker of ["A", "B"]) {
    const runRows = rows.filter((row) => row.runId === `RUN-${marker}`);
    assert.ok(runRows.every((row) => row.requestId === `transport-${marker}`));
    const modelStarts = runRows.filter(
      (row) => row.event === "model_step_started",
    );
    assert.deepEqual(
      modelStarts.map((row) => row.modelStep),
      [1, 2],
    );
    const ids = modelStarts.map((row) => row.modelRequestId);
    for (const id of ids) {
      assert.equal(typeof id, "string");
      assert.equal(allIds.has(id as string), false);
      allIds.add(id as string);
    }
    for (const row of runRows.filter((row) => row.event.startsWith("tool_"))) {
      assert.equal(row.modelRequestId, ids[0]);
      assert.equal(row.modelStep, 1);
    }
    event(runRows, "agent_completed");
    event(runRows, "tool_completed");
  }
});

test("a rejected Host model gate produces no provider request or started event", async (t) => {
  const logs = await logFixture(t);
  const executable = scriptedAgent(() => ({ text: '{"outcome":"complete"}' }));
  const secret = "PRIVATE_GATE_CAUSE_SENTINEL";
  let gates = 0;
  let completions = 0;
  await assert.rejects(
    withLogger(logs.logger, () =>
      createExecution({
        serviceModelObserver: {
          beforeStep() {
            gates++;
            throw new LoomError("RUN_STOPPED", secret);
          },
          afterStep() {
            completions++;
          },
        },
      }).executeAgent(executable, null, executionAccess().agent),
    ),
    { code: "STEP_EXECUTION_FAILED" },
  );
  assert.equal(executable.requests.length, 0);
  assert.equal(gates, 1);
  assert.equal(completions, 0);
  const rows = await logs.rows();
  assert.equal(
    rows.filter((row) => row.event.startsWith("model_step_")).length,
    0,
  );
  duration(event(rows, "agent_failed"));
  assert.equal(JSON.stringify(rows).includes(secret), false);
});

test("model and Tool failures close their own timing and omit private causes", async (t) => {
  const logs = await logFixture(t);
  const secret = "PRIVATE_FAILURE_CAUSE_SENTINEL";
  const model = scriptedAgent(async () => {
    await delay(8);
    throw new APICallError({
      message: secret,
      url: "https://fixture.invalid",
      requestBodyValues: { secret },
      statusCode: 503,
      responseBody: secret,
    });
  });
  await assert.rejects(
    withLogger(logs.logger.child({ runId: "RUN-model-failure" }), () =>
      createExecution().executeAgent(model, null, executionAccess().agent),
    ),
    { code: "LLM_REQUEST_FAILED" },
  );
  const explode = createTool({
    id: "explode",
    description: "Controlled failure",
    inputSchema: z.strictObject({}),
    execute: async () => {
      await delay(8);
      throw new Error(secret);
    },
  });
  const tool = scriptedAgent(
    () => ({ calls: [{ name: "explode", input: {} }] }),
    { explode },
  );
  await assert.rejects(
    withLogger(logs.logger.child({ runId: "RUN-tool-failure" }), () =>
      createExecution().executeAgent(tool, null, executionAccess().agent),
    ),
    { code: "TOOL_EXECUTION_FAILED" },
  );
  assert.equal(model.requests.length, 1);
  assert.equal(tool.requests.length, 1);
  const rows = await logs.rows();
  const modelRows = rows.filter((row) => row.runId === "RUN-model-failure");
  duration(event(modelRows, "model_step_failed"));
  duration(event(modelRows, "agent_failed"));
  assert.equal(
    modelRows.some((row) => row.event === "model_step_completed"),
    false,
  );
  const toolRows = rows.filter((row) => row.runId === "RUN-tool-failure");
  duration(event(toolRows, "tool_failed"));
  duration(event(toolRows, "agent_failed"));
  assert.equal(
    toolRows.some((row) => row.event === "tool_completed"),
    false,
  );
  assert.equal(
    rows.some((row) => row.event === "agent_completed"),
    false,
  );
  assert.equal(JSON.stringify(rows).includes(secret), false);
});

test("canceling a model or Tool logs stopped durations and prevents late completion", async (t) => {
  const logs = await logFixture(t);
  for (const mode of ["model", "tool"] as const) {
    const entered = deferred();
    const release = deferred();
    const access = executionAccess();
    const work = createTool({
      id: "work",
      description: "Deferred work",
      inputSchema: z.strictObject({}),
      execute: async () => {
        entered.resolve();
        await release.promise;
        return { done: true };
      },
    });
    const executable = scriptedAgent(
      async () => {
        if (mode === "model") {
          entered.resolve();
          await release.promise;
          return { text: '{"outcome":"complete"}' };
        }
        return { calls: [{ name: "work", input: {} }] };
      },
      { work },
    );
    const pending = withLogger(
      logs.logger.child({ runId: `RUN-cancel-${mode}` }),
      () => createExecution().executeAgent(executable, null, access.agent),
    );
    const rejected = assert.rejects(pending, { code: "RUN_STOPPED" });
    await entered.promise;
    await delay(8);
    access.controller.abort(new LoomError("RUN_STOPPED", "Stopped by test"));
    release.resolve();
    await rejected;
    assert.equal(executable.requests.length, 1);
    const rows = (await logs.rows()).filter(
      (row) => row.runId === `RUN-cancel-${mode}`,
    );
    duration(event(rows, "agent_stopped"));
    duration(
      event(rows, mode === "model" ? "model_step_stopped" : "tool_stopped"),
    );
    assert.equal(
      rows.some(
        (row) =>
          row.event === "agent_completed" || row.event === "tool_completed",
      ),
      false,
    );
    if (mode === "model")
      assert.equal(
        rows.some((row) => row.event === "model_step_completed"),
        false,
      );
  }
});
