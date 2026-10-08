import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import * as z from "zod";
import { LoomError, openLog } from "@intloom/utils";
import {
  executionAccess,
  latestToolResult,
  scriptedAgent,
} from "../../test/effector-fixture.ts";
import {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "./agent-context.ts";
import { createEffector } from "./create-effector.ts";
import { deferred, runtimeFixture } from "../../test/runtime-fixture.ts";
import { createRuntime } from "../runtime/create-runtime.ts";
import type { Blueprint } from "../workflow/blueprint.ts";
import type { AgentExecutionAccess } from "./execution.ts";
import type { JsonValue } from "../shared/json.ts";

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
      question: async (_input, access) => {
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
  f.codes.start = (_input, access) => {
    previous = access.signal;
    return { outcome: "complete" };
  };
  f.codes.review = (_input, access) => {
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
    { code: "STEP_EXECUTION_FAILED" },
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

test("SDK-rejected output is classified as an invalid result and retains its schema cause", async () => {
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
        assert.ok(error.cause instanceof Error && "id" in error.cause);
        assert.equal(
          error.cause.id,
          "STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED",
        );
        return true;
      },
    );
    assert.equal(executable.requests.length, 1);
  }
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
    { code: "STEP_EXECUTION_FAILED" },
  );
});
