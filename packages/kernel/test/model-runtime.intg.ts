import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { RequestContext } from "@mastra/core/request-context";

import { createTool } from "@mastra/core/tools";

import * as z from "zod";
import { openLog } from "@intloom/utils";

import { latestToolResult, scriptedAgent } from "./executor-fixture.ts";
import { getAgentExecutionAccess } from "../src/execution/agent-context.ts";
import { createExecution } from "../src/execution/create-execution.ts";

import { deferred, runtimeFixture } from "./runtime-fixture.ts";
import { createRuntimeHarness } from "./runtime-harness.ts";
import type { Blueprint } from "@intloom/loom-sdk";

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
    loomName: "fixture",
    inputs: ["prompt"],
    entryStageName: "first",
    stages: {
      first: {
        stageName: "first",
        stateSchema,
        initializeState: ({ input }) => ({ intent: input.prompt ?? "" }),
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
        on: { complete: { kind: "loom_end" } },
      },
    },
  };
  const effects: string[] = [];
  const storage = runtimeFixture().storage;
  const runtime = createRuntimeHarness({
    storage,
    logger: log.logger,
    executor: createExecution(),
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
    runtime.run(blueprint, { prompt: "A" }),
    runtime.run(blueprint, { prompt: "B" }),
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
    on: { complete: { kind: "loom_end" as const } },
  };
  const blueprint = { ...f.blueprint, stages: { first } };
  const runtime = createRuntimeHarness({
    ...f.options,
    executor: createExecution(),
    agents: { analyst: executable },
  });
  const start = runtime.run(blueprint, { prompt: "text" });
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
      await createRuntimeHarness({
        ...f.options,
        executor: createExecution(),
      }).run(f.blueprint, { prompt: "text" })
    ).status,
    "completed",
  );
});
