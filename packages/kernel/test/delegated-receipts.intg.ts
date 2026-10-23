import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { clientAgentFixture, agentRef } from "./client-agent-fixture.ts";
import { createRuntimeHarness } from "./runtime-harness.ts";
import { deferred } from "./runtime-fixture.ts";
import { createDelegatedSessions } from "../src/execution/delegated/sessions.ts";

test("closed Tool and completion receipts expire together after thirty settled minutes", async (t) => {
  let now = 0;
  const f = clientAgentFixture();
  const sessions = createDelegatedSessions(() => now);
  const runtime = createRuntimeHarness({
    ...f.options,
    executor: { ...f.options.executor, delegated: sessions },
  });
  t.after(() => runtime.suspend());
  const waiting = await runtime.run(
    f.blueprint,
    { prompt: "task" },
    "agent_ide",
  );
  const ref = agentRef(waiting);
  const claim = await sessions.claimAgentCall({ ...ref, claimId: "owner" });
  const request = {
    ...ref,
    ownerToken: claim.ownerToken,
    toolCallId: "tool-1",
    toolId: "add",
    input: { amount: 2 },
  };
  assert.deepEqual(await sessions.callAgentTool(request), { value: 2 });
  assert.ok(f.retained);
  await assert.rejects(f.retained.state.clear(), {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  const completion = {
    ...ref,
    ownerToken: claim.ownerToken,
    result: { outcome: "complete" },
  };
  const receipt = await sessions.completeAgentCall(completion);
  await setImmediate();
  now = 30 * 60 * 1000 - 1;
  assert.deepEqual(await sessions.callAgentTool(request), { value: 2 });
  assert.equal(f.writes, 1);
  assert.deepEqual(await sessions.completeAgentCall(completion), receipt);
  now++;
  await assert.rejects(sessions.callAgentTool(request), { code: "CONFLICT" });
  await assert.rejects(sessions.completeAgentCall(completion), {
    code: "CONFLICT",
  });
});
test("cancellation does not start retention while a Tool execution is still active", async (t) => {
  let now = 0;
  const f = clientAgentFixture();
  const gate = deferred();
  const entered = deferred();
  const tool = f.tools[0];
  assert.ok(tool);
  Object.assign(tool, {
    execute: async () => {
      entered.resolve();
      await gate.promise;
      return { value: 1 };
    },
  });
  const sessions = createDelegatedSessions(() => now);
  const runtime = createRuntimeHarness({
    ...f.options,
    executor: { ...f.options.executor, delegated: sessions },
  });
  t.after(() => runtime.suspend());
  const waiting = await runtime.run(
    f.blueprint,
    { prompt: "task" },
    "agent_ide",
  );
  const ref = agentRef(waiting);
  const claim = await sessions.claimAgentCall({ ...ref, claimId: "owner" });
  const request = {
    ...ref,
    ownerToken: claim.ownerToken,
    toolCallId: "tool-1",
    toolId: "add",
    input: { amount: 2 },
  };
  const pending = sessions.callAgentTool(request);
  const rejected = assert.rejects(pending);
  await entered.promise;
  await runtime.cancelRun(waiting.runId);
  now = 60 * 60 * 1000;
  assert.equal((await runtime.getRun(waiting.runId)).settled, false);
  gate.resolve();
  await rejected;
  await setImmediate();
  assert.equal((await runtime.getRun(waiting.runId)).settled, true);
  // The cached failure still belongs to the old call; it is not a missing-session conflict.
  await assert.rejects(
    sessions.callAgentTool(request),
    (error) =>
      error instanceof Error && "code" in error && error.code !== "CONFLICT",
  );
  now += 30 * 60 * 1000;
  await assert.rejects(sessions.callAgentTool(request), { code: "CONFLICT" });
});
test("active Tool receipt capacity never evicts successful effects", async (t) => {
  const f = clientAgentFixture();
  const runtime = f.create();
  t.after(() => runtime.suspend());
  const waiting = await runtime.run(
    f.blueprint,
    { prompt: "task" },
    "agent_ide",
  );
  const ref = agentRef(waiting);
  const claim = await runtime.claimAgentCall({ ...ref, claimId: "owner" });
  const request = {
    ...ref,
    ownerToken: claim.ownerToken,
    toolCallId: "0",
    toolId: "add",
    input: { amount: 1 },
  };
  for (let i = 0; i < 256; i++)
    await runtime.callAgentTool({ ...request, toolCallId: String(i) });
  await assert.rejects(
    runtime.callAgentTool({ ...request, toolCallId: "overflow" }),
    { code: "BUSY" },
  );
  assert.deepEqual(await runtime.callAgentTool(request), { value: 1 });
  assert.equal(f.writes, 256);
});

test("a post-Tool failure is the same receipt for concurrent and later retries", async (t) => {
  const f = clientAgentFixture();
  const gate = deferred();
  const entered = deferred();
  const tool = f.tools[0];
  assert.ok(tool);
  const execute = tool.execute;
  let finalChecks = 0;
  Object.assign(tool, {
    async execute(...args: Parameters<typeof execute>) {
      const result = await execute(...args);
      entered.resolve();
      await gate.promise;
      return result;
    },
    endsAgent() {
      finalChecks++;
      throw new Error("invalid final submission");
    },
  });
  const runtime = f.create();
  t.after(async () => {
    gate.resolve();
    await runtime.suspend();
  });
  const ref = agentRef(
    await runtime.run(f.blueprint, { prompt: "task" }, "agent_ide"),
  );
  const claim = await runtime.claimAgentCall({ ...ref, claimId: "owner" });
  const request = {
    ...ref,
    ownerToken: claim.ownerToken,
    toolCallId: "once",
    toolId: "add",
    input: { amount: 2 },
  };
  const first = assert.rejects(runtime.callAgentTool(request), {
    code: "TOOL_EXECUTION_FAILED",
  });
  await entered.promise;
  const concurrent = assert.rejects(runtime.callAgentTool(request), {
    code: "TOOL_EXECUTION_FAILED",
  });
  gate.resolve();
  await Promise.all([first, concurrent]);
  await setImmediate();
  await assert.rejects(runtime.callAgentTool(request), {
    code: "TOOL_EXECUTION_FAILED",
  });
  assert.equal(f.writes, 1);
  assert.equal(finalChecks, 1);
  assert.equal((await runtime.getRun(ref.runId)).status, "failed");
});
