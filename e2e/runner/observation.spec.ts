import assert from "node:assert/strict";
import { setImmediate } from "node:timers";
import { test } from "node:test";
import { Session } from "./session.ts";
import { runSchema, E2eError } from "./contracts.ts";
import { Evidence } from "./evidence.ts";
import type { toolSchema } from "./schema.ts";

const run = runSchema.parse({
  runId: "RUN-one",
  flowName: "intent",
  status: "running",
  cursor: { stageName: "solution", stepName: "design" },
  execution: { source: "cli", agentExecutor: "service" },
  control: { traceId: "trace", stepVisitId: 11 },
});
function session(signal = new AbortController().signal) {
  return new Session(
    {
      entry: "cmd",
      root: "/unused",
      suite: "/unused",
      flowName: "intent",
      casesRoot: "/unused",
      profile: "/unused",
      cli: "/unused",
      workflow: "/unused",
      seed: "fixture",
    },
    { storage: "file", limits: {}, mcpExecutor: "mcp_client" },
    {
      manifest: {
        id: "S99",
        version: 1,
        name: "Fixture",
        scale: "small",
        description: "Fixture",
        intents: ["Fixture"],
      },
      directory: "/unused",
      intent: "Fixture",
      knowledge: "## K01",
      knowledgeIds: ["K01"],
      files: [],
      digest: "fixture",
    },
    "/unused",
    new Evidence("/unused"),
    signal,
    {},
  );
}

test("MCP user sessions retain advertised schemas across rounds and reject misplaced flow arguments", async () => {
  const owned = session();
  owned.options.entry = "mcp";
  owned.caseData.manifest.intents.push("Second scope");
  const advertised = {
    name: "flow",
    description: "Admit a Run",
    inputSchema: {
      type: "object",
      properties: { flowName: { type: "string" }, intent: { type: "string" } },
      required: ["flowName", "intent"],
      additionalProperties: false,
    },
  };
  Reflect.set(owned, "client", {});
  Reflect.set(owned, "mcpTools", [
    advertised,
    { ...advertised, name: "claim_agent_call" },
  ]);
  owned.beginRound(0);
  assert.deepEqual(await owned.connectMcp(), {
    connected: true,
    tools: [advertised],
  });
  owned.activeRunId = run.runId;
  owned.runs.set(run.runId, { ...run, status: "completed", settled: true });
  owned.beginRound(1);
  assert.deepEqual(owned.mcpProtocol(), [advertised]);
  assert.deepEqual(await owned.connectMcp(), {
    connected: true,
    tools: [advertised],
  });
  const schema = owned.userTools().mcp_flow?.inputSchema as ReturnType<
    typeof toolSchema
  >;
  for (const input of [
    {
      flowName: "intent",
      arguments: { intent: "Second scope" },
    },
    { flowName: "intent" },
  ])
    assert.ok((await schema["~standard"].validate(input)).issues?.length);
  const valid = {
    flowName: "intent",
    intent: "Second scope",
  };
  assert.deepEqual(await schema["~standard"].validate(valid), { value: valid });
  const queries = owned.userTools().mcp_tool?.inputSchema as ReturnType<
    typeof toolSchema
  >;
  for (const name of ["flow", "claim_agent_call"])
    assert.ok(
      (await queries["~standard"].validate({ name, arguments: {} })).issues
        ?.length,
    );
});

test("a user finish decision cannot pass a missing or unfinished Run, and settlement uses the original Run", async () => {
  const owned = session();
  await assert.rejects(owned.finishRound(), { code: "RUN_MISSING" });
  Reflect.set(owned, "activeRunId", run.runId);
  owned.getRun = async () => run;
  await assert.rejects(owned.finishRound(), { code: "RUN_INCOMPLETE" });
  let queries = 0;
  owned.getRun = async (runId) => {
    assert.equal(runId, run.runId);
    queries++;
    return { ...run, status: "completed", settled: queries > 1 };
  };
  const completed = await owned.finishRound();
  assert.equal(completed.runId, run.runId);
  assert.equal(completed.settled, true);
  assert.equal(queries, 2);
});

test("MCP text errors preserve diagnostics without replay while invalid successful data fails", async () => {
  const owned = session();
  const events: { kind: string; data: unknown }[] = [];
  owned.evidence.event = async (kind, data) => {
    events.push({ kind, data });
  };
  owned.connectMcp = async () => ({ connected: true, tools: [] });
  let calls = 0;
  let response: unknown = {
    isError: true,
    content: [{ type: "text", text: "Choose exactly one Artifact selector." }],
  };
  Reflect.set(owned, "client", {
    callTool: async () => {
      calls++;
      return response;
    },
  });
  const rejected = await owned.mcp(
    "get_artifact",
    { artifactId: "ART-test", flowName: "intent" },
    undefined,
    false,
  );
  assert.deepEqual(rejected, {
    isError: true,
    data: {
      error: {
        code: "MCP_TOOL_ERROR",
        message: "Choose exactly one Artifact selector.",
      },
    },
  });
  assert.equal(calls, 1);
  assert.equal(events[0]?.kind, "mcp");
  response = {
    content: [{ type: "text", text: "Unexpected unstructured success." }],
  };
  await assert.rejects(owned.mcp("get_artifact", { artifactId: "ART-test" }), {
    code: "MCP_RESPONSE_INVALID",
  });
  assert.equal(calls, 2);
  assert.equal(events[1]?.kind, "mcp_response_invalid");
  response = {
    structuredContent: { artifact: { id: "ART-test", revision: 3 } },
    content: [{ type: "text", text: "Artifact found." }],
  };
  assert.deepEqual(
    await owned.mcp("get_artifact", { artifactId: "ART-test" }),
    {
      isError: false,
      data: { artifact: { id: "ART-test", revision: 3 } },
    },
  );
  assert.equal(calls, 3);
});

test("local polling records transitions once while retaining the newest Run snapshot", async () => {
  const owned = session();
  const events: { kind: string; data: unknown }[] = [];
  owned.evidence.event = async (kind, data) => {
    events.push({ kind, data });
  };
  let current = run;
  owned.cli = async (_args, _signal, capture) => {
    assert.equal(capture, false);
    return {
      code: 0,
      stdout: "",
      stderr: "",
      terminated: false,
      data: { ok: true, data: current },
    };
  };
  await owned.getRun(run.runId);
  current = runSchema.parse({
    ...run,
    revision: 2,
    metrics: { timing: { elapsedMs: 30000 } },
  });
  await owned.getRun(run.runId);
  assert.equal(events.length, 1);
  assert.equal(owned.runs.get(run.runId)?.revision, 2);
  current = runSchema.parse({
    ...current,
    status: "waiting",
    pendingAction: {
      id: "ASK-one",
      kind: "user_ask_confirmation",
      request: { context: "Confirm the current draft." },
    },
  });
  await owned.getRun(run.runId);
  current = runSchema.parse({
    ...current,
    control: { traceId: "trace", stepVisitId: 12 },
  });
  await owned.getRun(run.runId);
  current = runSchema.parse({
    ...current,
    status: "completed",
    settled: false,
    pendingAction: undefined,
  });
  await owned.getRun(run.runId);
  current = { ...current, settled: true };
  await owned.getRun(run.runId);
  assert.equal(events.length, 5);
  assert.ok(events.every((event) => event.kind === "run_observed"));
  assert.equal(owned.runs.get(run.runId)?.settled, true);
});

test("Run observation remains local beyond five seconds and returns only an actionable compact snapshot", async () => {
  const owned = session();
  let reads = 0;
  const action = {
    id: "ASK-one",
    kind: "user_ask_confirmation",
    request: { context: "Confirm the solution." },
  };
  owned.getRun = async () =>
    ++reads < 8 ? run : { ...run, status: "waiting", pendingAction: action };
  const observed = owned.observeRun(run.runId);
  const result = await observed;
  assert.equal(reads, 8);
  assert.equal(result.run.status, "waiting");
  assert.deepEqual(result.run.pendingAction, action);
  assert.equal(result.answerContract?.tool, "submit_confirmation");
  assert.equal("control" in result.run, false);
});

test("observation returns terminal and client Agent states immediately and respects cancellation", async () => {
  const owned = session();
  for (const snapshot of [
    { ...run, status: "completed" as const, settled: true },
    {
      ...run,
      status: "waiting" as const,
      pendingAgentCall: { id: "CALL-one" },
    },
  ]) {
    owned.getRun = async () => snapshot;
    assert.equal(
      (await owned.observeRun(run.runId)).run.status,
      snapshot.status,
    );
  }
  const controller = new AbortController();
  const canceled = session(controller.signal);
  canceled.getRun = async () => run;
  const cause = new E2eError(
    "EXECUTION_BUDGET_EXCEEDED",
    "Budget reached.",
    "runner",
  );
  const rejected = assert.rejects(canceled.observeRun(run.runId), {
    name: "AbortError",
  });
  await new Promise(setImmediate);
  controller.abort(cause);
  await rejected;
});
