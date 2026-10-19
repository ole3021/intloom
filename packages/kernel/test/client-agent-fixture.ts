import * as z from "zod";
import {
  defineAgentTool,
  type AgentTool,
  type AgentExecutionAccess,
  type JsonValue,
} from "@intloom/loom-sdk";
import { createRuntimeHarness } from "./runtime-harness.ts";
import { createExecution } from "../src/execution/create-execution.ts";
import { resolveRunExecution } from "../src/runtime/execution-policy.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { source, agentId } from "./loom-fixture.ts";
import type { LoadedAgent } from "../src/loom/types.ts";
import type { RunView } from "../src/runtime/run-view.ts";
import assert from "node:assert/strict";

export function clientAgentFixture() {
  const f = runtimeFixture();
  let retained: AgentExecutionAccess<JsonValue> | undefined;
  let writes = 0;
  const tools: AgentTool[] = [
    defineAgentTool({
      id: "add",
      description: "Add to the current value",
      inputSchema: z.strictObject({ amount: z.number() }),
      outputSchema: z.strictObject({ value: z.number() }),
      async execute(input, access) {
        retained = access;
        assert.equal("commit" in access.storage, false);
        assert.equal("interaction" in access, false);
        const state = z
          .object({ value: z.number(), intent: z.string() })
          .parse(access.state.value);
        const value = state.value + input.amount;
        await access.state.update({ ...state, value });
        writes++;
        return { value };
      },
    }),
  ];
  const resource: LoadedAgent = {
    agentId,
    source,
    spec: {
      name: "fixture",
      description: "Fixture",
      instructions:
        "Add to the value using Tools, then return complete or retry.",
      llm: "thinking",
      outputSchema: z.strictObject({ outcome: z.enum(["complete", "retry"]) }),
      tools,
      skills: [],
    },
  };
  Object.assign(f.first.steps, {
    start: {
      stepName: "start",
      execution: { kind: "agent", agentId },
      on: {
        complete: { kind: "step", stepName: "review" },
        retry: { kind: "step", stepName: "start" },
      },
    },
  });
  const options: import("./runtime-harness.ts").TestRuntimeOptions = {
    ...f.options,
    agentResources: { [agentId]: resource },
    executor: createExecution(),
    prepareExecution: async (_blueprint, entry) =>
      resolveRunExecution(entry, true),
  };
  return {
    ...f,
    resource,
    tools,
    options,
    get retained() {
      return retained;
    },
    get writes() {
      return writes;
    },
    create: () => createRuntimeHarness(options),
  };
}

export function agentRef(run: RunView) {
  assert.equal(run.status, "waiting");
  assert.ok(run.pendingAgentCall);
  assert.equal(run.pendingAction, undefined);
  return { runId: run.runId, callId: run.pendingAgentCall.id };
}
