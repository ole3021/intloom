import * as z from "zod";
import {
  defineAgentTool,
  type AgentTool,
  type AgentExecutionAccess,
  type JsonValue,
} from "@intloom/workflow-sdk";
import { createRuntime } from "../src/runtime/create-runtime.ts";
import { createEffector } from "../src/effector/create-effector.ts";
import { resolveRunExecution } from "../src/runtime/execution-policy.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { source, agentId } from "./workflow-fixture.ts";
import type { LoadedAgent } from "../src/workflow/types.ts";
import type { RuntimeOptions } from "../src/runtime/contracts.ts";
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
      llm: "reasoning",
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
  const options: RuntimeOptions = {
    ...f.options,
    agentResources: { [agentId]: resource },
    effector: createEffector(),
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
    create: () => createRuntime(options),
  };
}

export function agentRef(run: RunView) {
  assert.equal(run.status, "waiting");
  assert.ok(run.pendingAgentCall);
  assert.equal(run.pendingAction, undefined);
  return { runId: run.runId, callId: run.pendingAgentCall.id };
}
