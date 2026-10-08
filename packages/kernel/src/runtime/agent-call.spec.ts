import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import * as z from "zod";
import { defineAgentTool } from "@intloom/workflow-sdk";
import {
  agentRef,
  clientAgentFixture,
} from "../../test/client-agent-fixture.ts";
import { deferred } from "../../test/runtime-fixture.ts";
import { createRuntime } from "./create-runtime.ts";

test("client Agent calls continue through human confirmation and multiple Stages without replay", async () => {
  const f = clientAgentFixture();
  let confirmations = 0;
  f.codes.review = async (_input, access) => {
    confirmations++;
    const answer = await access.interaction.confirm("Save this value?");
    assert.equal(answer.isConfirmed, true);
    return { outcome: "complete" };
  };
  const runtime = f.create();
  const run = await runtime.flow(f.blueprint, "original intent", "agent_ide");
  const ref = agentRef(run);
  const claim = await runtime.claimAgentCall({ ...ref, claimId: "client-a" });
  assert.deepEqual(
    await runtime.claimAgentCall({ ...ref, claimId: "client-a" }),
    claim,
  );
  assert.equal(
    JSON.stringify(await runtime.getAgentCall(ref)).includes(claim.ownerToken),
    false,
  );
  const owner = { ...ref, ownerToken: claim.ownerToken };
  assert.deepEqual(
    await runtime.callAgentTool({
      ...owner,
      toolCallId: "one",
      toolId: "add",
      input: { amount: 2 },
    }),
    { value: 2 },
  );
  assert.deepEqual(
    await runtime.callAgentTool({
      ...owner,
      toolCallId: "one",
      toolId: "add",
      input: { amount: 2 },
    }),
    { value: 2 },
  );
  assert.equal(f.writes, 1);
  assert.throws(() => f.retained?.state.value, {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
  const request = { ...owner, result: { outcome: "complete" } };
  const waiting = await runtime.completeAgentCall(request);
  assert.equal(waiting.pendingAgentCall, undefined);
  assert.ok(waiting.pendingAction);
  assert.deepEqual(await runtime.completeAgentCall(request), waiting);
  await assert.rejects(
    runtime.completeAgentCall({ ...owner, result: { outcome: "retry" } }),
    { code: "CONFLICT" },
  );
  const completed = await runtime.answerAsk(
    run.runId,
    waiting.pendingAction.id,
    { isConfirmed: true },
  );
  assert.equal(completed.status, "completed");
  assert.equal(confirmations, 1);
  assert.deepEqual(f.events, ["init:first", "init:second", "code:finish"]);
  assert.throws(() => f.retained?.state.value, {
    code: "EXECUTION_OWNERSHIP_LOST",
  });
});

test("single ownership, serial Tool calls and in-flight receipts prevent duplicate effects", async () => {
  const f = clientAgentFixture();
  const entered = deferred();
  const gate = deferred();
  let calls = 0;
  f.tools.push(
    defineAgentTool({
      id: "slow",
      description: "slow",
      inputSchema: z.json(),
      outputSchema: z.json(),
      async execute() {
        calls++;
        entered.resolve();
        await gate.promise;
        return "ok";
      },
    }),
  );
  const runtime = f.create();
  const ref = agentRef(await runtime.flow(f.blueprint, "task", "agent_ide"));
  const claims = await Promise.allSettled([
    runtime.claimAgentCall({ ...ref, claimId: "a" }),
    runtime.claimAgentCall({ ...ref, claimId: "b" }),
  ]);
  assert.equal(claims.filter((r) => r.status === "fulfilled").length, 1);
  const claimed = claims[0];
  assert.ok(claimed?.status === "fulfilled");
  const owner = { ...ref, ownerToken: claimed.value.ownerToken };
  const request = { ...owner, toolCallId: "slow", toolId: "slow", input: null };
  const one = runtime.callAgentTool(request);
  await entered.promise;
  const duplicate = runtime.callAgentTool(request);
  await assert.rejects(
    runtime.callAgentTool({ ...request, toolCallId: "other" }),
    { code: "BUSY" },
  );
  await assert.rejects(runtime.callAgentTool({ ...request, input: 1 }), {
    code: "CONFLICT",
  });
  await assert.rejects(
    runtime.callAgentTool({ ...request, ownerToken: "wrong" }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    runtime.completeAgentCall({ ...owner, result: { outcome: "complete" } }),
    { code: "BUSY" },
  );
  await assert.rejects(runtime.failAgentCall({ ...owner, message: "failed" }), {
    code: "BUSY",
  });
  gate.resolve();
  assert.deepEqual(await Promise.all([one, duplicate]), ["ok", "ok"]);
  assert.equal(calls, 1);
  await runtime.cancelAllRuns();
  await assert.rejects(runtime.callAgentTool(request), { code: "CONFLICT" });
});

test("invalid Tool inputs and undeclared Tools preserve waiting; old call IDs and cross-Run tokens cannot write", async () => {
  const f = clientAgentFixture();
  const runtime = f.create();
  const a = agentRef(await runtime.flow(f.blueprint, "a", "agent_ide"));
  const b = agentRef(await runtime.flow(f.blueprint, "b", "agent_ide"));
  const ca = await runtime.claimAgentCall({ ...a, claimId: "a" });
  const cb = await runtime.claimAgentCall({ ...b, claimId: "b" });
  const owner = { ...a, ownerToken: ca.ownerToken };
  await assert.rejects(
    runtime.callAgentTool({
      ...owner,
      toolCallId: "bad",
      toolId: "add",
      input: { amount: "wrong" },
    }),
    { code: "INVALID_REQUEST" },
  );
  await assert.rejects(
    runtime.callAgentTool({
      ...owner,
      toolCallId: "absent",
      toolId: "commit",
      input: {},
    }),
    { code: "INVALID_REQUEST" },
  );
  await assert.rejects(
    runtime.callAgentTool({
      ...owner,
      ownerToken: cb.ownerToken,
      toolCallId: "cross",
      toolId: "add",
      input: { amount: 1 },
    }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    runtime.answerAsk(a.runId, a.callId, { isConfirmed: true }),
    { code: "CONFLICT" },
  );
  const next = await runtime.completeAgentCall({
    ...owner,
    result: { outcome: "retry" },
  });
  assert.notEqual(agentRef(next).callId, a.callId);
  await assert.rejects(
    runtime.completeAgentCall({ ...owner, result: { outcome: "retry" } }),
    { code: "CONFLICT" },
  );
  assert.equal((await runtime.getRun(b.runId)).status, "waiting");
  assert.equal(f.writes, 0);
  await runtime.cancelAllRuns();
});

test("Tool input/output and Agent output transforms run once; completion retries only read the receipt", async () => {
  const f = clientAgentFixture();
  let inputs = 0;
  let outputs = 0;
  let finals = 0;
  f.tools.push(
    defineAgentTool({
      id: "transform",
      description: "transform",
      inputSchema: z.number().transform((n) => {
        inputs++;
        return n + 1;
      }),
      outputSchema: z
        .string()
        .transform((n) => {
          outputs++;
          return Number(n) + 1;
        })
        .pipe(z.number()),
      execute: (n) => String(n),
    }),
  );
  const resource = {
    ...f.resource,
    spec: {
      ...f.resource.spec,
      outputSchema: z
        .object({ outcome: z.literal("complete") })
        .transform((v) => {
          finals++;
          return v;
        }),
    },
  };
  const runtime = createRuntime({
    ...f.options,
    agentResources: { [resource.agentId]: resource },
  });
  const ref = agentRef(
    await runtime.flow(f.blueprint, "transform", "agent_ide"),
  );
  const { ownerToken, task } = await runtime.claimAgentCall({
    ...ref,
    claimId: "one",
  });
  const resultSchema = task.tools.find(
    (tool) => tool.id === "transform",
  )?.outputSchema;
  assert.ok(
    resultSchema &&
      typeof resultSchema === "object" &&
      !Array.isArray(resultSchema) &&
      "type" in resultSchema,
  );
  assert.equal(resultSchema.type, "number");
  const tool = {
    ...ref,
    ownerToken,
    toolCallId: "one",
    toolId: "transform",
    input: 1,
  };
  assert.equal(await runtime.callAgentTool(tool), 3);
  assert.equal(await runtime.callAgentTool(tool), 3);
  const completion = { ...ref, ownerToken, result: { outcome: "complete" } };
  await Promise.all([
    runtime.completeAgentCall(completion),
    runtime.completeAgentCall(completion),
  ]);
  assert.deepEqual([inputs, outputs, finals], [1, 1, 1]);
});

for (const mode of ["throw", "caught_access", "invalid_output"] as const) {
  test(`Tool ${mode} fails the original Agent call without replay`, async () => {
    const f = clientAgentFixture();
    let attempts = 0;
    f.tools.push(
      defineAgentTool({
        id: "broken",
        description: "broken",
        inputSchema: z.json(),
        outputSchema: z.string(),
        async execute(_input, access) {
          attempts++;
          if (mode === "throw") throw new Error("private failure");
          if (mode === "caught_access") {
            try {
              await access.state.update(null);
            } catch {
              /* Must remain failed. */
            }
            return "ok";
          }
          return 1 as unknown as string;
        },
      }),
    );
    const runtime = f.create();
    const ref = agentRef(await runtime.flow(f.blueprint, mode, "agent_ide"));
    const { ownerToken } = await runtime.claimAgentCall({
      ...ref,
      claimId: "one",
    });
    await assert.rejects(
      runtime.callAgentTool({
        ...ref,
        ownerToken,
        toolCallId: "one",
        toolId: "broken",
        input: null,
      }),
    );
    await setImmediate();
    const failed = await runtime.getRun(ref.runId);
    assert.equal(failed.status, "failed");
    assert.equal(failed.pendingAgentCall, undefined);
    assert.equal(attempts, 1);
    await assert.rejects(
      runtime.completeAgentCall({
        ...ref,
        ownerToken,
        result: { outcome: "complete" },
      }),
      { code: "CONFLICT" },
    );
  });
}

test("cancel revokes an in-flight Tool and late State writes without stopping another Run", async () => {
  const f = clientAgentFixture();
  const entered = deferred();
  const gate = deferred();
  let late: unknown;
  f.tools.push(
    defineAgentTool({
      id: "late",
      description: "late",
      inputSchema: z.json(),
      outputSchema: z.json(),
      async execute(_input, access) {
        entered.resolve();
        await gate.promise;
        try {
          await access.state.update({ value: 10, intent: "late" });
        } catch (cause) {
          late = cause;
        }
        return "done";
      },
    }),
  );
  const runtime = f.create();
  const ref = agentRef(await runtime.flow(f.blueprint, "a", "agent_ide"));
  const b = await runtime.flow(f.blueprint, "b", "agent_ide");
  const { ownerToken } = await runtime.claimAgentCall({ ...ref, claimId: "a" });
  const pending = runtime.callAgentTool({
    ...ref,
    ownerToken,
    toolCallId: "late",
    toolId: "late",
    input: null,
  });
  const rejected = assert.rejects(pending);
  await entered.promise;
  await runtime.cancelRun(ref.runId);
  gate.resolve();
  await rejected;
  assert.ok(late);
  assert.equal(
    (await runtime.getRun(ref.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  assert.ok((await runtime.getRun(b.runId)).pendingAgentCall);
  await runtime.cancelAllRuns();
});

test("Agent failure and invalid final output fail without implicit retries", async () => {
  for (const mode of ["failure", "invalid"] as const) {
    const f = clientAgentFixture();
    const runtime = f.create();
    const ref = agentRef(await runtime.flow(f.blueprint, mode, "agent_ide"));
    const { ownerToken } = await runtime.claimAgentCall({
      ...ref,
      claimId: "a",
    });
    const run =
      mode === "failure"
        ? await runtime.failAgentCall({
            ...ref,
            ownerToken,
            message: "Cannot execute",
          })
        : await runtime.completeAgentCall({
            ...ref,
            ownerToken,
            result: { outcome: "not_allowed" },
          });
    assert.equal(run.status, "failed");
    assert.equal(
      run.lastError?.code,
      mode === "failure" ? "STEP_EXECUTION_FAILED" : "AGENT_OUTPUT_INVALID",
    );
    assert.equal(run.pendingAgentCall, undefined);
  }
});

test("asset access uses declared IDs, rechecks paths and handles text/binary without exposing absolute paths", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-agent-assets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "data.txt"), "asset text");
  await writeFile(join(root, "data.bin"), Buffer.from([255]));
  await writeFile(join(root, "large.bin"), Buffer.alloc(1024 * 1024 + 1));
  const f = clientAgentFixture();
  const resource = {
    ...f.resource,
    source: { ...f.resource.source, assetRoot: root },
    spec: {
      ...f.resource.spec,
      skills: [
        {
          name: "skill",
          description: "skill",
          content: "read data.txt",
          assets: ["data.txt", "data.bin", "escape", "large.bin"],
        },
      ],
    },
  };
  await symlink(join(root, ".."), join(root, "escape"));
  const runtime = createRuntime({
    ...f.options,
    agentResources: { [resource.agentId]: resource },
  });
  const ref = agentRef(await runtime.flow(f.blueprint, "assets", "agent_ide"));
  const claim = await runtime.claimAgentCall({ ...ref, claimId: "a" });
  const owner = { ...ref, ownerToken: claim.ownerToken };
  assert.equal(JSON.stringify(claim.task).includes(root), false);
  assert.deepEqual(
    await runtime.readAgentAsset({ ...owner, assetId: "asset_0" }),
    { content: "asset text", encoding: "utf8" },
  );
  assert.deepEqual(
    await runtime.readAgentAsset({ ...owner, assetId: "asset_1" }),
    { content: "/w==", encoding: "base64" },
  );
  await assert.rejects(
    runtime.readAgentAsset({ ...owner, assetId: "asset_2" }),
    { code: "INVALID_REQUEST" },
  );
  await assert.rejects(
    runtime.readAgentAsset({ ...owner, assetId: "asset_3" }),
    { code: "INVALID_REQUEST" },
  );
  await assert.rejects(
    runtime.readAgentAsset({ ...owner, assetId: "../data.txt" }),
    { code: "NOT_FOUND" },
  );
  await runtime.cancelAllRuns();
});

test("a bounded receipt table never evicts old IDs and re-executes their effects", async () => {
  const f = clientAgentFixture();
  const runtime = f.create();
  const ref = agentRef(await runtime.flow(f.blueprint, "limit", "agent_ide"));
  const { ownerToken } = await runtime.claimAgentCall({ ...ref, claimId: "a" });
  const request = { ...ref, ownerToken, toolId: "add", input: { amount: 1 } };
  for (let i = 0; i < 256; i++)
    await runtime.callAgentTool({ ...request, toolCallId: `id_${i}` });
  await assert.rejects(
    runtime.callAgentTool({ ...request, toolCallId: "overflow" }),
    { code: "BUSY" },
  );
  assert.deepEqual(
    await runtime.callAgentTool({ ...request, toolCallId: "id_0" }),
    { value: 1 },
  );
  assert.equal(f.writes, 256);
  await runtime.cancelAllRuns();
});

test("host suspension revokes a claimed Agent task and rejects late tools and results", async () => {
  const f = clientAgentFixture();
  const runtime = f.create();
  const ref = agentRef(await runtime.flow(f.blueprint, "stop", "agent_ide"));
  const { ownerToken } = await runtime.claimAgentCall({
    ...ref,
    claimId: "client",
  });
  await runtime.suspend();
  const stopped = await runtime.getRun(ref.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.pendingAgentCall, undefined);
  await assert.rejects(runtime.claimAgentCall({ ...ref, claimId: "client" }), {
    code: "CONFLICT",
  });
  await assert.rejects(
    runtime.callAgentTool({
      ...ref,
      ownerToken,
      toolCallId: "late",
      toolId: "add",
      input: { amount: 1 },
    }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    runtime.completeAgentCall({
      ...ref,
      ownerToken,
      result: { outcome: "complete" },
    }),
    { code: "CONFLICT" },
  );
  assert.equal(f.writes, 0);
  assert.deepEqual(await runtime.getRun(ref.runId), stopped);
});
