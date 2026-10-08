import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  connectProject,
  connectProjectClient,
  discoverProjectConnection,
  startService,
  type ProjectClient,
  type StoredRecord,
} from "@intloom/cli";
import { connection, pending, projectFixture } from "./project-fixture.ts";

test("CLI, Studio backend and Agent IDE share business clients and resume the same host Run", async (t) => {
  const root = await projectFixture(t);
  const { service } = await startService({ projectRoot: root });
  const cliConnection = await discoverProjectConnection(root);
  const studioConnection = await discoverProjectConnection(root, "studio");
  assert.equal(new URL(cliConnection.url).pathname, "/internal/mcp");
  assert.equal(new URL(studioConnection.url).pathname, "/internal/mcp/studio");
  assert.equal(
    new URL(studioConnection.url).origin,
    new URL(service.url).origin,
  );
  const cli: ProjectClient = await connectProject(root);
  const studio: ProjectClient = await connectProjectClient(studioConnection);
  const ide: ProjectClient = await connectProjectClient({
    ...cliConnection,
    url: service.url,
  });
  t.after(async () => {
    await Promise.all([cli.close(), studio.close(), ide.close()]);
  });
  const original = await cli.flow("fixture", "  shared\n意图  ");
  assert.deepEqual(await studio.getRun(original.runId), original);
  const [ideWorkflow] = await ide.listWorkflows();
  const [cliWorkflow] = await cli.listWorkflows();
  assert.ok(ideWorkflow?.isAvailable && cliWorkflow?.isAvailable);
  assert.equal(ideWorkflow.flowName, cliWorkflow.flowName);
  assert.equal(ideWorkflow.readiness?.agentExecutor, "mcp_client");
  assert.equal(cliWorkflow.readiness?.agentExecutor, "service");
  assert.deepEqual(original.execution, {
    source: "cli",
    agentExecutor: "service",
  });
  const confirmation = await studio.answerAsk(
    original.runId,
    pending(original).id,
    [
      { questionId: "place", isSkipped: false, answer: "  Local\n部署  " },
      { questionId: "notes", isSkipped: true },
    ],
  );
  const completed = await ide.answerAsk(
    original.runId,
    pending(confirmation).id,
    { isConfirmed: true },
  );
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.execution, original.execution);
  const record: StoredRecord | null = await studio.getRecord(original.runId);
  assert.ok(record);
  assert.deepEqual(await cli.getRecord(original.runId), record);
  assert.equal((await ide.listRuns()).length, 1);
  assert.equal(await studio.getRecord("missing"), null);
  assert.equal(await studio.getArtifact({ artifactId: "missing" }), null);
  assert.deepEqual((await studio.listArtifacts()).data, []);

  const waiting = await studio.flow("fixture", "retain after close");
  await studio.close();
  assert.deepEqual(await ide.getRun(waiting.runId), waiting);
  assert.equal(
    (await cli.cancelRun(waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  await assert.rejects(studio.listRuns(), { code: "PROJECT_CLIENT_CLOSED" });
});

for (const version of ["2025-11-25", "2026-07-28"] as const)
  test(`${version}: internal entries share tools and never infer a Codex profile from clientName`, async (t) => {
    const root = await projectFixture(t);
    await startService({ projectRoot: root });
    const endpoint = await discoverProjectConnection(root, "studio");
    const raw = new Client(
      { name: "codex", version: "1.0.0" },
      {
        capabilities: { elicitation: { form: {} } },
        versionNegotiation: {
          mode: version === "2026-07-28" ? { pin: version } : "legacy",
        },
      },
    );
    const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), {
      requestInit: { headers: { authorization: `Bearer ${endpoint.token}` } },
    });
    await raw.connect(transport);
    t.after(async () => {
      try {
        if (transport.sessionId) await transport.terminateSession();
      } catch {
        // The project fixture may have stopped the host before client cleanup.
      } finally {
        await raw.close();
      }
    });
    raw.setRequestHandler("elicitation/create", async () =>
      assert.fail("Studio presents its own forms"),
    );
    const tools = (await raw.listTools()).tools;
    assert.ok(tools.some((tool) => tool.name === "flow"));
    const flow = tools.find((tool) => tool.name === "flow");
    assert.deepEqual(Object.keys(flow?.inputSchema.properties ?? {}).sort(), [
      "flowName",
      "intent",
    ]);
    const cli = await connectProject(root);
    t.after(() => cli.close());
    const waiting = await cli.flow("fixture", "Studio form");
    const interaction = await raw.callTool({
      name: "interact",
      arguments: { runId: waiting.runId, actionId: pending(waiting).id },
    });
    const content = interaction.structuredContent;
    assert.ok(
      content && typeof content === "object" && "interaction" in content,
    );
    assert.equal(content.interaction, "unavailable");
    assert.deepEqual(await cli.getRun(waiting.runId), waiting);
    const rejected = await raw.callTool({
      name: "flow",
      arguments: {
        flowName: "fixture",
        intent: "reject override",
        source: "agent_ide",
      },
    });
    assert.equal(rejected.isError, true);
    assert.equal((await cli.listRuns()).length, 1);
  });

test("legacy sessions cannot cross entry paths and unauthorized clients cannot reach any entry", async (t) => {
  const root = await projectFixture(t);
  const { service } = await startService({ projectRoot: root });
  const saved = await connection(root);
  const client = new Client(
    { name: "codex", version: "1.0.0" },
    {
      versionNegotiation: { mode: "legacy" },
    },
  );
  const transport = new StreamableHTTPClientTransport(new URL(service.url), {
    requestInit: { headers: { authorization: `Bearer ${saved.token}` } },
  });
  await client.connect(transport);
  t.after(async () => {
    try {
      await transport.terminateSession();
    } catch {
      // The project fixture may have stopped the host before client cleanup.
    } finally {
      await client.close();
    }
  });
  assert.ok(transport.sessionId);
  for (const path of ["/internal/mcp", "/internal/mcp/studio", "/mcp/codex"]) {
    const url = new URL(path, service.url);
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${saved.token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": transport.sessionId,
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 30,
        method: "tools/list",
        params: {},
      }),
    });
    assert.equal(response.status, 404);
    await response.body?.cancel();
  }
  assert.ok((await client.listTools()).tools.length > 0);
});
