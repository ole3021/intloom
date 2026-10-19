import assert from "node:assert/strict";
import { test } from "node:test";
import { defineAgentTool } from "@intloom/loom-sdk";
import * as z from "zod";
import {
  deferred,
  fixtureStateSchema,
  runtimeFixture,
} from "./runtime-fixture.ts";
import { createRun } from "../src/runtime/create-run.ts";
import { createRunEntry } from "../src/runtime/run-entry.ts";
import { beginCall, endCall } from "../src/runtime/call-scope.ts";
import { createAgentAccess } from "../src/runtime/execution-access.ts";
import { executeAgentTool } from "../src/execution/agent-tool.ts";
import {
  bindAgentContext,
  getAgentExecutionAccess,
} from "../src/execution/model/agent-context.ts";
import { executionAccess } from "./access-fixture.ts";
import { scriptedAgent } from "./executor-fixture.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { serviceTool } from "../src/execution/model/agent-tools.ts";

for (const modelContext of [false, true])
  test(`Tool lifetime rejects a detached async State write (${modelContext ? "model context" : "direct"})`, async (t) => {
    const f = runtimeFixture();
    const entered = deferred();
    const release = deferred();
    Object.assign(f.first, {
      stateSchema: fixtureStateSchema.superRefine(async (value) => {
        if (value.value === 9) {
          entered.resolve();
          await release.promise;
        }
      }),
    });
    const entry = createRunEntry(
      f.blueprint,
      createRun(
        f.blueprint,
        { prompt: "review" },
        { source: "cli", agentExecutor: "service" },
      ),
    );
    await entry.stageState.enter(f.first);
    const call = beginCall(entry);
    t.after(() => {
      release.resolve();
      endCall(entry, call);
    });
    const original = createAgentAccess(entry, call, f.storage);
    const access = modelContext
      ? getAgentExecutionAccess(bindAgentContext(original, () => {}))
      : original;
    let write: Promise<void> | undefined;
    const tool = defineAgentTool({
      id: "write",
      description: "Start a State update",
      inputSchema: z.null(),
      outputSchema: z.boolean(),
      async execute(_, bound) {
        write = bound.state.update({ intent: "review", value: 9 });
        void write.catch(() => {});
        await entered.promise;
        return true;
      },
    });
    await assert.rejects(executeAgentTool(tool, null, access), {
      code: "CALL_UNSETTLED",
    });
    release.resolve();
    assert.ok(write);
    await assert.rejects(write, { code: "EXECUTION_OWNERSHIP_LOST" });
    assert.equal(fixtureStateSchema.parse(entry.stageState.value).value, 0);
    // The Agent call remains live; only this Tool's capabilities were revoked.
    call.assertCurrent();
    await original.state.update({ intent: "review", value: 2 });
    assert.equal(fixtureStateSchema.parse(entry.stageState.value).value, 2);
  });

test("model adaptation fails closed for an Access copy without its live binding", () => {
  assert.throws(
    () => bindAgentContext({ ...executionAccess().agent }, () => {}),
    { code: "CAPABILITY_DENIED" },
  );
});

test("service Tool errors cannot be swallowed by the model framework", async () => {
  const f = executionAccess();
  const gate = deferred();
  const started = deferred();
  f.storage.getArtifact = async () => {
    started.resolve();
    await gate.promise;
    return undefined;
  };
  const tool = defineAgentTool({
    id: "read",
    description: "Read a stored artifact",
    inputSchema: z.strictObject({}),
    outputSchema: z.boolean(),
    async execute(_, access) {
      void access.storage.getArtifact("fixture", "first").catch(() => {});
      await started.promise;
      return true;
    },
  });
  const agent = scriptedAgent(
    () => ({ calls: [{ name: "read", input: {} }] }),
    { read: serviceTool(tool) },
  );
  try {
    await assert.rejects(createExecution().executeAgent(agent, null, f.agent), {
      code: "CALL_UNSETTLED",
    });
    assert.equal(agent.requests.length, 1);
  } finally {
    gate.resolve();
  }
});
