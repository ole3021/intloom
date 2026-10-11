import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { connectProject, startService, serviceStatus } from "@intloom/cli";
import { bin, pending, projectFixture, untilRun } from "./project-fixture.ts";
for (const era of ["legacy", "modern"] as const)
  test(`${era}: stdio proxy forwards server elicitation and disconnect preserves waiting Run`, {
    timeout: 20000,
  }, async (t) => {
    const root = await projectFixture(t);
    const started = await startService({ projectRoot: root });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin, "mcp", "serve", "--project", root, "--ide", "codex"],
      stderr: "pipe",
    });
    const client = new Client(
      { name: "proxy-test", version: "1" },
      {
        capabilities: { elicitation: { form: {} } },
        ...(era === "modern"
          ? { versionNegotiation: { mode: { pin: "2026-07-28" } } }
          : {}),
      },
    );
    let diagnostics = "";
    transport.stderr?.on("data", (data) => {
      diagnostics += data;
    });
    t.after(() => client.close());
    try {
      await client.connect(transport);
    } catch (cause) {
      throw new Error(`Proxy handshake failed: ${diagnostics}`, { cause });
    }
    let prompts = 0;
    client.setRequestHandler("elicitation/create", async () => {
      prompts++;
      return {
        action: "accept",
        content: { q0_choice: "option_0", q1_skip: true },
      };
    });
    const created = await client.callTool({
      name: "flow",
      arguments: { flowName: "fixture", intent: "proxy" },
    });
    assert.equal(created.isError, undefined, JSON.stringify(created));
    const runId = (created.structuredContent as { run: { runId: string } }).run
      .runId;
    const observer = await connectProject(root);
    t.after(() => observer.close());
    const waiting = await untilRun(
      observer,
      runId,
      (run) => run.status === "waiting",
    );
    const answered = await client.callTool({
      name: "interact",
      arguments: { runId, actionId: pending(waiting).id },
    });
    assert.equal(answered.isError, undefined, JSON.stringify(answered));
    assert.equal(prompts, 1);
    const confirmation = await untilRun(
      observer,
      runId,
      (run) =>
        run.status === "waiting" &&
        run.pendingAction?.id !== waiting.pendingAction?.id,
    );
    await client.close();
    assert.equal(
      (await serviceStatus(root)).instanceId,
      started.service.instanceId,
    );
    assert.equal(
      (await observer.getRun(runId)).pendingAction?.id,
      confirmation.pendingAction?.id,
    );
  });
