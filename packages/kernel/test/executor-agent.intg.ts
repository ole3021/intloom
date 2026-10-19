import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";

import type { RequestContext } from "@mastra/core/request-context";

import { createTool } from "@mastra/core/tools";

import * as z from "zod";
import { LoomError } from "@intloom/utils";
import { executionAccess } from "./access-fixture.ts";
import { latestToolResult, scriptedAgent } from "./executor-fixture.ts";
import {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "../src/execution/agent-context.ts";
import { createExecution } from "../src/execution/create-execution.ts";

import type { AgentExecutionAccess } from "@intloom/loom-sdk";
import type { JsonValue } from "@intloom/loom-sdk";

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
    await createExecution().executeAgent(
      executable,
      null,
      executionAccess().agent,
    ),
    { outcome: "complete" },
  );
  assert.equal(executions, 1);
  assert.equal(attempts, 3);
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
    await createExecution().executeAgent(executable, null, f.agent),
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
    createExecution().executeAgent(executable, null, f.agent),
    (error) => error === cause,
  );
  await assert.rejects(
    createExecution().executeAgent(
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
    createExecution({ maxAgentSteps: 1 }).executeAgent(
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

test("a Storage failure caught by a business Tool still fails the Agent invocation", async () => {
  const failure = new Error("Storage failed");
  const f = executionAccess();
  f.storage.getArtifact = async () => {
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
    createExecution().executeAgent(executable, null, f.agent),
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
    createExecution().executeAgent(executable, null, executionAccess().agent),
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
    createExecution().executeAgent(executable, null, executionAccess().agent),
  );
  assert.equal(executable.requests.length, 1);
  await assert.rejects(
    createExecution().executeAgent(
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

test("host model observer gates each actual request without replaying a Tool", async () => {
  let beforeCalls = 0;
  const usage: unknown[] = [];
  const executable = scriptedAgent(() => ({ text: '{"outcome":"complete"}' }));
  assert.deepEqual(
    await createExecution({
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
    createExecution({
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
