import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import type { LoomCode } from "@intloom/loom-sdk";
import {
  type CompiledLoom,
  compiledLoomProtocolVersion,
} from "@intloom/loom-sdk/compiled";
import { loadCapabilityModule } from "../src/loom/capability.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { createRuntimeHarness } from "./runtime-harness.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { source } from "./loom-fixture.ts";
import { openRunCheckpointStore } from "../src/host/checkpoints/store.ts";
import { waitForRun } from "../src/operations/wait-run.ts";
import { waitForSettledRun } from "./run-observer.ts";

const location = { file: "loom.yaml" };
function capability(): CompiledLoom {
  return {
    definition: {
      name: "capability",
      version: "1.0.0",
      description: "Test",
      input: { type: "string", minLength: 1 },
      output: { type: "string" },
      agents: {},
      interactions: {},
      acceptance: { checks: [] },
    },
    plan: {
      steps: [
        {
          id: "execute",
          kind: "code",
          binding: "main",
          input: { from: "input" },
          source: location,
        },
        {
          id: "output",
          kind: "output",
          input: { from: "execute" },
          source: location,
        },
        { id: "deliver", kind: "deliver", source: location },
      ],
    },
    bindings: {
      codes: { main: (input: string) => input.toUpperCase() },
      checks: {},
      tools: {},
    },
  };
}
function fixture(t: TestContext, module: CompiledLoom) {
  const loaded = loadCapabilityModule(
    { ...source, protocolVersion: compiledLoomProtocolVersion },
    module,
  );
  const directory = mkdtempSync(join(tmpdir(), "intloom-capability-"));
  const runtimes: ReturnType<typeof createRuntimeHarness>[] = [];
  const create = (agents = {}) => {
    const runtime = createRuntimeHarness({
      codes: loaded.codes,
      agents,
      agentResources: Object.fromEntries(
        Object.entries(loaded.agentSpecs).map(([agentId, spec]) => [
          agentId,
          { agentId, spec, source },
        ]),
      ),
      executor: createExecution(),
      storage: runtimeFixture().storage,
      recovery: {
        store: openRunCheckpointStore(directory),
        blueprints: { capability: loaded.blueprint },
        loomIdentities: { capability: "exact-fixture-v1" },
      },
    });
    runtimes.push(runtime);
    return runtime;
  };
  t.after(async () => {
    for (const runtime of runtimes) await runtime.suspend();
    rmSync(directory, { recursive: true, force: true });
  });
  return { loaded, create, directory };
}
function confirmation(module: CompiledLoom) {
  module.definition.interactions.approve = {
    kind: "confirm",
    title: "Approve delivery",
    context: module.definition.output,
  };
  module.definition.acceptance.confirmation = "approve";
  module.plan.steps.splice(-1, 0, {
    id: "confirm",
    kind: "confirm",
    interaction: "approve",
    source: location,
  });
}

test("capability Code rejects input before execution, delivers typed output and retains terminal output", async (t) => {
  const f = fixture(t, capability()),
    runtime = f.create();
  await assert.rejects(runtime.startRun(f.loaded.blueprint, 12), {
    code: "INVALID_REQUEST",
  });
  const run = await runtime.run(f.loaded.blueprint, "hello");
  assert.equal(run.status, "completed");
  assert.equal(run.output, "HELLO");
  await runtime.suspend();
  const restored = f.create();
  await restored.restore();
  assert.equal((await restored.getRun(run.runId)).output, "HELLO");
});
test("invalid output and failed acceptance never deliver", async (t) => {
  const invalid = capability();
  invalid.definition.output = { type: "number" };
  const a = fixture(t, invalid);
  const result = await a.create().run(a.loaded.blueprint, "bad");
  assert.equal(result.status, "failed");
  assert.equal(result.output, undefined);
  const failed = capability();
  failed.definition.acceptance.checks = [{ id: "rule", binding: "rule" }];
  (failed.bindings.checks as Record<string, unknown>).rule = () => ({
    passed: false,
    message: "Rejected",
  });
  failed.plan.steps.splice(-1, 0, {
    id: "check",
    kind: "check",
    check: "rule",
    source: location,
  });
  const b = fixture(t, failed);
  const checked = await b.create().run(b.loaded.blueprint, "bad");
  assert.equal(checked.status, "failed");
  assert.match(checked.lastError?.message ?? "", /rule/);
  assert.equal(checked.output, undefined);
});
test("final confirmation resumes the saved candidate without executing Code again and rejects duplicate answers", async (t) => {
  const module = capability();
  confirmation(module);
  let calls = 0;
  (module.bindings.codes as Record<string, unknown>).main = (input: string) => {
    calls++;
    return input.toUpperCase();
  };
  const f = fixture(t, module),
    first = f.create();
  const waiting = await first.run(f.loaded.blueprint, "draft");
  assert.equal(waiting.pendingAction?.kind, "user_ask_interaction");
  assert.equal(waiting.output, undefined);
  await first.suspend();
  const second = f.create();
  await second.restore();
  const action = (await second.getRun(waiting.runId)).pendingAction;
  assert.ok(action);
  assert.equal(action.id, waiting.pendingAction?.id);
  assert.throws(
    () => second.submitAnswer(waiting.runId, action.id, { confirmed: "yes" }),
    { code: "INVALID_REQUEST" },
  );
  const done = await second.answerAsk(waiting.runId, action.id, {
    confirmed: true,
  });
  assert.equal(done.status, "completed");
  assert.equal(done.output, "DRAFT");
  assert.equal(calls, 1);
  assert.throws(
    () => second.submitAnswer(waiting.runId, action.id, { confirmed: true }),
    { code: "CONFLICT" },
  );
});
test("declined or cancelled confirmation cannot become a delivered result", async (t) => {
  const module = capability();
  confirmation(module);
  const f = fixture(t, module),
    runtime = f.create();
  const waiting = await runtime.run(f.loaded.blueprint, "draft");
  assert.ok(waiting.pendingAction);
  const declined = await runtime.answerAsk(
    waiting.runId,
    waiting.pendingAction.id,
    { confirmed: false },
  );
  assert.equal(declined.status, "failed");
  assert.equal(declined.output, undefined);
  const other = await runtime.run(f.loaded.blueprint, "another");
  await runtime.cancelRun(other.runId);
  const stopped = await waitForSettledRun(runtime, other.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.output, undefined);
});
test("Code resumes only an explicit interaction continuation after restart", async (t) => {
  for (const resumable of [true, false]) {
    const module = capability();
    module.definition.interactions.choose = {
      kind: "select",
      title: "Choose",
      context: { type: "string" },
      response: { type: "string", enum: ["a", "b"] },
    };
    let calls = 0;
    let recoveries = 0;
    const code: LoomCode<string, string> = async (input, context) => {
      calls++;
      return String(await context.interaction.request("choose", input));
    };
    if (resumable)
      code.recover = (saved, input) => {
        recoveries++;
        assert.equal(saved.request.interactionId, "choose");
        assert.equal(saved.request.context, input);
        return String(saved.answer);
      };
    (module.bindings.codes as Record<string, unknown>).main = code;
    const f = fixture(t, module);
    const first = f.create();
    const waiting = await first.run(f.loaded.blueprint, "pick");
    assert.ok(waiting.pendingAction);
    await first.suspend();
    const restored = f.create();
    await restored.restore();
    if (resumable) {
      const done = await restored.answerAsk(
        waiting.runId,
        waiting.pendingAction.id,
        "b",
      );
      assert.equal(done.status, "completed");
      assert.equal(done.output, "b");
      assert.equal(recoveries, 1);
    } else {
      const interrupted = await restored.getRun(waiting.runId);
      assert.equal(interrupted.lastError?.code, "RUN_INTERRUPTED");
      assert.equal(interrupted.output, undefined);
      assert.equal(recoveries, 0);
    }
    assert.equal(calls, 1);
  }
});
test("service and delegated Agents receive business input and return business output through the same plan", async (t) => {
  const module = capability();
  module.definition.agents.worker = {
    name: "worker",
    description: "Worker",
    instructions: "Convert input",
    modelProfile: "standard",
    input: { type: "string" },
    output: { type: "string" },
    interactions: [],
    skills: [],
    tools: [],
  };
  module.plan.steps[0] = {
    id: "execute",
    kind: "agent",
    agent: "worker",
    input: { from: "input" },
    source: location,
  };
  const f = fixture(t, module);
  const resource = Object.entries(f.loaded.agentSpecs)[0];
  assert.ok(resource);
  const [id, spec] = resource;
  const runtime = f.create({
    [id]: {
      outputSchema: spec.outputSchema,
      async execute(input: unknown) {
        assert.equal(input, "hello");
        return "service";
      },
    },
  });
  assert.equal(
    (await runtime.run(f.loaded.blueprint, "hello")).output,
    "service",
  );
  const waiting = await runtime.run(f.loaded.blueprint, "external", {
    source: "agent_ide",
    agentExecutor: "mcp_client",
  });
  assert.ok(waiting.pendingAgentCall);
  const ref = { runId: waiting.runId, callId: waiting.pendingAgentCall.id };
  const claimed = await runtime.claimAgentCall({ ...ref, claimId: "owner" });
  assert.equal(claimed.task.input, "external");
  const completed = await runtime.completeAgentCall({
    ...ref,
    ownerToken: claimed.ownerToken,
    result: "delegated",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.output, "delegated");
});
test("delegated Agent transfers to one human action and resumes its original owned call", async (t) => {
  const module = capability();
  module.definition.interactions.choose = {
    kind: "form",
    title: "Choose",
    context: { type: "string" },
    response: { type: "string", enum: ["a", "b"] },
  };
  module.definition.agents.worker = {
    name: "worker",
    description: "Worker",
    instructions: "Ask user",
    modelProfile: "light",
    input: { type: "string" },
    output: { type: "string" },
    interactions: ["choose"],
    skills: [],
    tools: [],
  };
  module.plan.steps[0] = {
    id: "execute",
    kind: "agent",
    agent: "worker",
    input: { from: "input" },
    source: location,
  };
  const f = fixture(t, module),
    runtime = f.create();
  const waiting = await runtime.run(f.loaded.blueprint, "choice", {
    source: "agent_ide",
    agentExecutor: "mcp_client",
  });
  assert.ok(waiting.pendingAgentCall);
  const ref = { runId: waiting.runId, callId: waiting.pendingAgentCall.id };
  const { ownerToken } = await runtime.claimAgentCall({
    ...ref,
    claimId: "owner",
  });
  const promise = runtime.callAgentTool({
    ...ref,
    ownerToken,
    toolCallId: "choose-once",
    toolId: "interaction_choose",
    input: { context: "a or b" },
  });
  void promise.catch(() => {});
  await setImmediate();
  const human = await runtime.getRun(waiting.runId);
  assert.ok(human.pendingAction);
  assert.equal(human.pendingAgentCall, undefined);
  await assert.rejects(
    runtime.completeAgentCall({ ...ref, ownerToken, result: "premature" }),
  );
  runtime.submitAnswer(human.runId, human.pendingAction.id, "b");
  assert.equal(await promise, "b");
  const resumed = await runtime.getRun(human.runId);
  assert.equal(resumed.pendingAgentCall?.id, ref.callId);
  assert.equal(resumed.pendingAction, undefined);
  await runtime.completeAgentCall({ ...ref, ownerToken, result: "b" });
  assert.equal((await waitForRun(runtime, human.runId)).output, "b");
});

test("null capability input stays null", async (t) => {
  const module = capability();
  module.definition.input = { type: "null" };
  module.definition.output = { type: "null" };
  (module.bindings.codes as Record<string, unknown>).main = (
    input: unknown,
  ) => {
    assert.equal(input, null);
    return null;
  };
  const f = fixture(t, module);
  assert.equal((await f.create().run(f.loaded.blueprint, null)).output, null);
});

test("native Agent model boundary receives input and unwraps scalar output with human interaction", async (t) => {
  const { scriptedAgent, latestToolResult } = await import(
    "./executor-fixture.ts"
  );
  const { serviceTool } = await import("../src/execution/model/agent-tools.ts");
  const module = capability();
  module.definition.interactions.choose = {
    kind: "form",
    title: "Choose",
    context: { type: "string" },
    response: { type: "string" },
  };
  module.definition.agents.worker = {
    name: "worker",
    description: "Worker",
    instructions: "Ask",
    modelProfile: "standard",
    input: { type: "string" },
    output: { type: "string" },
    interactions: ["choose"],
    skills: [],
    tools: [],
  };
  module.plan.steps[0] = {
    id: "execute",
    kind: "agent",
    agent: "worker",
    input: { from: "input" },
    source: location,
  };
  const f = fixture(t, module);
  const resource = Object.entries(f.loaded.agentSpecs)[0];
  assert.ok(resource);
  const [id, spec] = resource;
  const native = scriptedAgent(
    (request) => {
      assert.match(JSON.stringify(request.prompt), /native-input/);
      return latestToolResult(request)
        ? {
            calls: [
              {
                name: "intloom_complete_step",
                input: { output: "native-result" },
              },
            ],
          }
        : {
            calls: [
              { name: "interaction_choose", input: { context: "choose" } },
            ],
          };
    },
    Object.fromEntries(spec.tools.map((tool) => [tool.id, serviceTool(tool)])),
  );
  const runtime = f.create({
    [id]: { ...native, capability: true, outputSchema: spec.outputSchema },
  });
  const waiting = await runtime.run(f.loaded.blueprint, "native-input");
  assert.ok(waiting.pendingAction, JSON.stringify(waiting));
  const done = await runtime.answerAsk(
    waiting.runId,
    waiting.pendingAction.id,
    "yes",
  );
  assert.equal(done.status, "completed");
  assert.equal(done.output, "native-result");
  assert.ok(native.requests.length >= 2);
});

test("branch merge accepts exactly one produced value and fails on ambiguous or absent branches", async (t) => {
  for (const [left, right, succeeds] of [
    [true, false, true],
    [false, true, true],
    [true, true, false],
    [false, false, false],
  ] as const) {
    const module = capability();
    const first = module.plan.steps[0];
    assert.ok(first?.kind === "code");
    module.plan.steps.splice(
      0,
      1,
      {
        ...first,
        id: "left",
        when: { value: { from: "input" }, equals: left ? "hello" : "other" },
      },
      {
        ...first,
        id: "right",
        when: { value: { from: "input" }, equals: right ? "hello" : "other" },
      },
    );
    const output = module.plan.steps[2];
    assert.ok(output?.kind === "output");
    output.input = { from: ["left", "right"] };
    const f = fixture(t, module),
      result = await f.create().run(f.loaded.blueprint, "hello");
    assert.equal(result.status, succeeds ? "completed" : "failed");
    assert.equal(result.output, succeeds ? "HELLO" : undefined);
  }
});
test("declared author failures expose safe diagnostics; ordinary exceptions remain internal", async (t) => {
  const { LoomFailure } = await import("@intloom/loom-sdk");
  for (const declared of [true, false]) {
    const module = capability();
    (module.bindings.codes as Record<string, unknown>).main = () => {
      throw declared
        ? new LoomFailure("BOOKING_OUTCOME_UNKNOWN", "Inspect original request")
        : new Error("internal-provider-payload");
    };
    const f = fixture(t, module),
      run = await f.create().run(f.loaded.blueprint, "hello");
    assert.equal(run.status, "failed");
    if (declared)
      assert.match(
        run.lastError?.message ?? "",
        /BOOKING_OUTCOME_UNKNOWN: Inspect original request/,
      );
    else
      assert.doesNotMatch(
        run.lastError?.message ?? "",
        /internal-provider-payload/,
      );
  }
});
