import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  connectProject,
  connectProjectClient,
  discoverProjectConnection,
  startService,
  stopService,
  serviceStatus,
} from "@intloom/cli";
import {
  cli,
  projectFixture,
  pending,
  configureProject,
  untilRun,
} from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";

test("fresh init without llms starts a real host without Looms", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t, (directory) =>
    stopService(join(directory, "project")).then(
      () => {},
      () => {},
    ),
  );
  const root = join(base, "project");
  const initialized = await cli(root, ["init", "--json"]);
  assert.equal(initialized.code, 0, initialized.stdout);
  const yaml = await readFile(join(root, "intloom.yaml"), "utf8");
  assert.match(yaml, /^useMcpAgent: true$/m);
  assert.doesNotMatch(yaml, /^llms:/m);
  const { service } = await startService({ projectRoot: root });
  assert.equal(service.availableWorkflowCount, 0);
  const local = await connectProject(root);
  const connection = await discoverProjectConnection(root);
  const ide = await connectProjectClient({
    ...connection,
    url: `${service.url}/codex`,
  });
  t.after(async () => {
    await local.close();
    await ide.close();
  });
  assert.deepEqual(await ide.listWorkflows(), []);
  assert.equal((await ide.listRuns()).length, 0);
  const config = await cli(root, ["config", "codex"]);
  assert.equal(config.code, 0, config.stdout);
  assert.match(config.stdout, /mcp/);
  await local.close();
  await ide.close();
  await stopService(root);
  await assert.rejects(serviceStatus(root), { code: "CLI_SERVICE_OFFLINE" });
});

test("model-free Code Run uses MCP policy while CLI/Studio reject creation; cross-entry cancellation preserves policy", async (t) => {
  const root = await projectFixture(t);
  await configureProject(root, { llms: undefined });
  const { service } = await startService({ projectRoot: root });
  const connection = await discoverProjectConnection(root);
  const cliClient = await connectProject(root);
  const studio = await connectProjectClient(
    await discoverProjectConnection(root, "studio"),
  );
  const ide = await connectProjectClient({
    ...connection,
    url: `${service.url}/codex`,
  });
  t.after(async () => {
    await Promise.all([cliClient.close(), studio.close(), ide.close()]);
  });
  for (const client of [cliClient, studio]) {
    await assert.rejects(client.flow("fixture", "No configuration"), {
      code: "INVALID_REQUEST",
    });
    const [workflow] = await client.listWorkflows();
    assert.ok(workflow?.isAvailable);
    assert.equal(workflow.readiness?.status, "configuration_required");
  }
  assert.deepEqual(await ide.listRuns(), []);
  const receipt = await ide.flow("fixture", "MCP without model config");
  const waiting = await untilRun(
    ide,
    receipt.runId,
    (run) => run.status === "waiting",
  );
  assert.equal(waiting.status, "waiting");
  assert.ok(pending(waiting));
  assert.deepEqual(waiting.execution, {
    source: "agent_ide",
    agentExecutor: "mcp_client",
  });
  const stopped = await studio.cancelRun(waiting.runId);
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  assert.deepEqual(stopped.execution, waiting.execution);
  assert.deepEqual(
    (await cliClient.getRun(waiting.runId)).execution,
    waiting.execution,
  );
  await Promise.all([cliClient.close(), studio.close(), ide.close()]);
  await stopService(root);
  await configureProject(root, { useMcpAgent: false });
  const restarted = await startService({ projectRoot: root });
  const serviceIde = await connectProjectClient({
    ...(await discoverProjectConnection(root)),
    url: restarted.service.url,
  });
  t.after(() => serviceIde.close());
  await assert.rejects(serviceIde.flow("fixture", "MCP service mode"), {
    code: "INVALID_REQUEST",
  });
  assert.deepEqual(await serviceIde.listRuns(), []);
});
