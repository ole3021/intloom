import { waitForRun } from "../src/operations/wait-run.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { projectFixture } from "./project-fixture.ts";
import { compiledLoom } from "./initialization-fixture.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { agentId, codeId } from "./loom-fixture.ts";
import { credential, testConfig } from "./agent-fixture.ts";
import { initializeProject } from "../src/host/create-project-execution.ts";
import { run, listRuns, listLooms } from "./operations-harness.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { loadConfig } from "../src/host/config/load-config.ts";

test("optional models and default policy preserve strict supplied config validation", async (t) => {
  const project = await projectFixture(t);
  await project.configure("");
  const config = await loadConfig(project.root);
  assert.equal(config.useMcpAgent, true);
  assert.equal(config.llms, undefined);
  for (const extra of [
    { useMcpAgent: "true" },
    { llms: null },
    { llms: {} },
    { llms: { default: { model: "missing-provider" } } },
  ]) {
    await project.configure(JSON.stringify({ ...extra }));
    await assert.rejects(loadConfig(project.root), {
      code: "INVALID_REQUEST",
    });
  }
  await project.configure("useMcpAgent: false\n");
  assert.equal((await loadConfig(project.root)).useMcpAgent, false);
});

test("model-free projects reject service admission and execute client Agents without preparing a model", async (t) => {
  const project = await projectFixture(t);
  await project.add(
    "probe",
    compiledLoom("probe", codeId, { [agentId]: "thinking" }).replace(
      `execution: { kind: "code", codeId: ${JSON.stringify(codeId)} }`,
      `execution: { kind: "agent", agentId: ${JSON.stringify(agentId)} }`,
    ),
  );
  await project.configure("");
  const fixture = runtimeFixture();
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected model request");
  });
  const projectExecution = await initializeProject(project.root, {
    ...fixture.options,
    executor: createExecution(),
  });
  const blueprint = projectExecution.registries.blueprints.probe;
  assert.ok(blueprint?.stages.first);
  const initialize = t.mock.method(
    blueprint.stages.first,
    "initializeState",
    () => {
      throw new Error("Stage must not start");
    },
  );
  const agent = projectExecution.registries.agents[agentId];
  assert.ok(agent);
  assert.equal("agent" in agent, false);
  for (const source of ["cli", "studio"] as const) {
    const [view] = await listLooms(projectExecution, source);
    assert.ok(view?.isAvailable);
    assert.equal(view.readiness?.status, "configuration_required");
    const code = "INVALID_REQUEST";
    await assert.rejects(
      run(projectExecution, "probe", { prompt: "test" }, source),
      {
        code,
      },
    );
    await assert.rejects(projectExecution.prepareExecution(blueprint, source), {
      code,
    });
  }
  assert.equal(initialize.mock.calls.length, 0);
  assert.equal(network.mock.calls.length, 0);
  assert.deepEqual(await listRuns(projectExecution), []);
  initialize.mock.restore();
  const waiting = await run(
    projectExecution,
    "probe",
    { prompt: "client" },
    "agent_ide",
  );
  assert.equal(waiting.status, "waiting");
  assert.ok(waiting.pendingAgentCall);
  const ref = { runId: waiting.runId, callId: waiting.pendingAgentCall.id };
  const claim = await projectExecution.executor.delegated.claimAgentCall({
    ...ref,
    claimId: "test-client",
  });
  const completed = await projectExecution.executor.delegated.completeAgentCall(
    {
      ...ref,
      ownerToken: claim.ownerToken,
      result: { outcome: "complete" },
    },
  );
  assert.equal(completed.status, "accepted");
  assert.equal(
    (await waitForRun(projectExecution.runtime, completed.runId)).status,
    "completed",
  );
  assert.equal(network.mock.calls.length, 0);
});

test("Code-only MCP Runs need no llms; CLI, Studio and MCP false still require service configuration", async (t) => {
  const project = await projectFixture(t);
  await project.add("probe", compiledLoom("probe", codeId));
  await project.configure("");
  const execution = await initializeProject(
    project.root,
    runtimeFixture().options,
  );
  const done = await run(
    execution,
    "probe",
    { prompt: "code only" },
    "agent_ide",
  );
  assert.equal(done.status, "completed");
  assert.deepEqual(done.execution, {
    source: "agent_ide",
    agentExecutor: "mcp_client",
  });
  for (const source of ["cli", "studio"] as const)
    await assert.rejects(
      run(execution, "probe", { prompt: "no models" }, source),
      {
        code: "INVALID_REQUEST",
      },
    );
  await project.configure("useMcpAgent: false\n");
  const service = await initializeProject(
    project.root,
    runtimeFixture().options,
  );
  await assert.rejects(
    run(service, "probe", { prompt: "no models" }, "agent_ide"),
    {
      code: "INVALID_REQUEST",
    },
  );
  assert.deepEqual(await listRuns(service), []);
  assert.equal((await listRuns(execution)).length, 1);
});

test("missing credentials do not block loading; only the target Loom's Agent roles are prepared", async (t) => {
  const project = await projectFixture(t);
  const body = compiledLoom("probe", codeId, {
    [agentId]: "coding",
  }).replace(
    `execution: { kind: "code", codeId: ${JSON.stringify(codeId)} }`,
    `execution: { kind: "agent", agentId: ${JSON.stringify(agentId)} }`,
  );
  await project.add("probe", body);
  const config = testConfig();
  config.llms.coding = {
    ...config.llms.default,
    secret: "ENV.INTLOOM_NO_LLMS_MISSING_KEY",
  };
  const previous = process.env.INTLOOM_NO_LLMS_MISSING_KEY;
  delete process.env.INTLOOM_NO_LLMS_MISSING_KEY;
  t.after(() => {
    if (previous !== undefined)
      process.env.INTLOOM_NO_LLMS_MISSING_KEY = previous;
  });
  await project.configure(JSON.stringify(config));
  const execution = await initializeProject(
    project.root,
    runtimeFixture().options,
  );
  assert.equal((await listLooms(execution))[0]?.isAvailable, true);
  await assert.rejects(run(execution, "probe", { prompt: "test" }), {
    code: "INVALID_REQUEST",
    message: /INTLOOM_NO_LLMS_MISSING_KEY/,
  });
  assert.deepEqual(await listRuns(execution), []);
  const [clientView] = await listLooms(execution, "agent_ide");
  assert.ok(clientView?.isAvailable);
  assert.equal(clientView.readiness?.status, "available");
});

test("one project keeps client calls separate from CLI, Studio and MCP service model execution", async (t) => {
  credential(t);
  const project = await projectFixture(t);
  await project.add(
    "probe",
    compiledLoom("probe", codeId, { [agentId]: "thinking" }).replace(
      `execution: { kind: "code", codeId: ${JSON.stringify(codeId)} }`,
      `execution: { kind: "agent", agentId: ${JSON.stringify(agentId)} }`,
    ),
  );
  const config = testConfig();
  await project.configure(JSON.stringify(config));
  const network = t.mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) => {
      assert.equal(JSON.parse(String(init?.body)).stream, true);
      const frames = [
        {
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: 0,
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: '{"outcome":"complete"}' },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: 0,
          model: "test-model",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      ];
      return new Response(
        frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") +
          "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  );
  const execution = await initializeProject(project.root, {
    ...runtimeFixture().options,
    executor: createExecution(),
  });
  const client = await run(
    execution,
    "probe",
    { prompt: "client" },
    "agent_ide",
  );
  assert.ok(client.pendingAgentCall);
  assert.equal(network.mock.calls.length, 0);
  assert.equal(execution.executionStatus().preparedServiceAgents, 0);
  for (const source of ["cli", "studio"] as const) {
    const completed = await run(execution, "probe", { prompt: source }, source);
    assert.equal(
      completed.status,
      "completed",
      JSON.stringify(completed.lastError),
    );
    assert.deepEqual(completed.execution, { source, agentExecutor: "service" });
  }
  assert.equal(network.mock.calls.length, 2);
  assert.equal(execution.executionStatus().preparedServiceAgents, 1);
  assert.deepEqual(await execution.runtime.getRun(client.runId), client);
  const ref = { runId: client.runId, callId: client.pendingAgentCall.id };
  const claimed = await execution.executor.delegated.claimAgentCall({
    ...ref,
    claimId: "client",
  });
  const done = await execution.executor.delegated.completeAgentCall({
    ...ref,
    ownerToken: claimed.ownerToken,
    result: { outcome: "complete" },
  });
  assert.equal(done.status, "accepted");
  assert.deepEqual(
    (await execution.runtime.getRun(done.runId)).execution,
    client.execution,
  );
  assert.equal(network.mock.calls.length, 2);
  await project.configure(JSON.stringify({ ...config, useMcpAgent: false }));
  const service = await initializeProject(project.root, {
    ...runtimeFixture().options,
    executor: createExecution(),
  });
  const external = await run(
    service,
    "probe",
    { prompt: "MCP service" },
    "agent_ide",
  );
  assert.equal(external.status, "completed");
  assert.deepEqual(external.execution, {
    source: "agent_ide",
    agentExecutor: "service",
  });
  assert.equal(network.mock.calls.length, 3);
});
