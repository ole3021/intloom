import assert from "node:assert/strict";
import { test } from "node:test";
import type { CallToolResult } from "@modelcontextprotocol/client";
import type { RunView } from "@intloom/kernel";
import { startService, connectProject } from "@intloom/cli";
import { mcpClient, pending, projectFixture } from "./project-fixture.ts";

function data(result: CallToolResult) {
  assert.ok(result.structuredContent);
  return result.structuredContent as { run: RunView; interaction?: string };
}

for (const era of ["legacy", "modern"] as const)
  test(`${era} Codex form interaction resumes the same Run without replay`, {
    timeout: 20_000,
  }, async (t) => {
    const root = await projectFixture(t);
    await startService({ projectRoot: root });
    const { client, transport } = await mcpClient(t, root, {
      capabilities: { elicitation: { form: {} } },
      ...(era === "modern"
        ? { versionNegotiation: { mode: { pin: "2026-07-28" } } }
        : {}),
    });
    if (era === "modern") assert.equal(transport.protocolVersion, "2026-07-28");
    let prompts = 0;
    client.setRequestHandler("elicitation/create", async (request) => {
      prompts++;
      assert.equal(request.params.mode, "form");
      assert.equal(request.params.requestedSchema.type, "object");
      return prompts === 1
        ? {
            action: "accept",
            content: { q0_choice: "option_0", q1_skip: true },
          }
        : { action: "accept", content: { decision: "confirm" } };
    });
    const created = await client.callTool({
      name: "flow",
      arguments: { flowName: "fixture", intent: "native" },
    });
    assert.equal(created.isError, undefined);
    const initial = data(created).run;
    const reply = await client.callTool({
      name: "interact",
      arguments: { runId: initial.runId, actionId: pending(initial).id },
    });
    assert.equal(reply.isError, undefined, JSON.stringify(reply));
    const confirm = data(reply).run;
    assert.equal(confirm.runId, initial.runId);
    assert.notEqual(pending(confirm).id, pending(initial).id);
    const done = await client.callTool({
      name: "interact",
      arguments: { runId: confirm.runId, actionId: pending(confirm).id },
    });
    assert.equal(done.isError, undefined, JSON.stringify(done));
    assert.equal(data(done).run.status, "completed");
    assert.equal(prompts, 2);
    const observer = await connectProject(root);
    assert.equal((await observer.listRuns()).length, 1);
    assert.notEqual(await observer.getRecord(`once-${initial.runId}`), null);
    await observer.close();
  });

for (const era of ["legacy", "modern"] as const)
  test(`${era}: cancelling/declining native form keeps the same waiting action`, async (t) => {
    const root = await projectFixture(t);
    await startService({ projectRoot: root });
    const observer = await connectProject(root);
    t.after(() => observer.close());
    const initial = await observer.flow("fixture", "cancel-form");
    const { client } = await mcpClient(t, root, {
      capabilities: { elicitation: { form: {} } },
      ...(era === "modern"
        ? { versionNegotiation: { mode: { pin: "2026-07-28" } } }
        : {}),
    });
    for (const action of ["cancel", "decline"] as const) {
      client.setRequestHandler("elicitation/create", async () => ({ action }));
      const result = await client.callTool({
        name: "interact",
        arguments: {
          runId: initial.runId,
          actionId: pending(initial).id,
        },
      });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      assert.equal(data(result).interaction, "dismissed");
      assert.deepEqual(await observer.getRun(initial.runId), initial);
    }
  });

test("capability/profile fallback exposes current action for explicit answer_ask", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const observer = await connectProject(root);
  t.after(() => observer.close());
  const initial = await observer.flow("fixture", "fallback");
  const { client } = await mcpClient(t, root);
  const result = await client.callTool({
    name: "interact",
    arguments: { runId: initial.runId, actionId: pending(initial).id },
  });
  assert.equal(data(result).interaction, "unavailable");
  assert.deepEqual(data(result).run, initial);
  const answered = await client.callTool({
    name: "answer_ask",
    arguments: {
      runId: initial.runId,
      actionId: pending(initial).id,
      answer: [
        { questionId: "place", isSkipped: false, answer: "human" },
        { questionId: "notes", isSkipped: true },
      ],
    },
  });
  assert.equal(data(answered).run.status, "waiting");
  assert.notEqual(pending(data(answered).run).id, pending(initial).id);
});

test("malformed native form does not consume action; concurrent replies have one winner", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const observer = await connectProject(root);
  t.after(() => observer.close());
  const initial = await observer.flow("fixture", "race");
  const { client } = await mcpClient(t, root, {
    capabilities: { elicitation: { form: {} } },
  });
  client.setRequestHandler("elicitation/create", async () => ({
    action: "accept",
    content: { q0_choice: "custom", q0_answer: " \n", q1_skip: true },
  }));
  const invalid = await client.callTool({
    name: "interact",
    arguments: { runId: initial.runId, actionId: pending(initial).id },
  });
  assert.equal(invalid.isError, true);
  assert.deepEqual(await observer.getRun(initial.runId), initial);
  const other = await connectProject(root);
  t.after(() => other.close());
  const answers = [
    { questionId: "place", isSkipped: false, answer: "human" },
    { questionId: "notes", isSkipped: true },
  ];
  const result = await Promise.allSettled([
    observer.answerAsk(initial.runId, pending(initial).id, answers),
    other.answerAsk(initial.runId, pending(initial).id, answers),
  ]);
  assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(result.filter((item) => item.status === "rejected").length, 1);
});
