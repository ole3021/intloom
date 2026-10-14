import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createCliCore } from "@intloom/cli";
import { projectFixture } from "./project-fixture.ts";

test("a lost mutation response is recovered from its receipt without submitting a second Run", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const serviceInstanceId = started.data.service.instanceId;
  const operationId = randomUUID();
  const original = globalThis.fetch;
  let submissions = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);
      if (
        new URL(String(args[0])).pathname === "/api/v1/cli/runs" &&
        args[1]?.method === "POST"
      ) {
        submissions++;
        assert.equal(response.status, 200);
        await response.arrayBuffer();
        throw new TypeError("simulated response loss after admission");
      }
      return response;
    },
  );
  const result = await core.flow({
    projectPath,
    serviceInstanceId,
    operationId,
    flowName: "fixture",
    intent: "one admission",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "REQUEST_OUTCOME_UNKNOWN");
    assert.match(result.error.message, /CLI_SERVICE_OFFLINE/u);
    assert.equal(result.outcome, "unknown");
    assert.equal(result.meta.operationId, operationId);
    assert.equal(result.meta.projectRoot, projectPath);
    assert.equal(result.meta.serviceInstanceId, serviceInstanceId);
  }
  const receipt = await core.getOperation({
    projectPath,
    serviceInstanceId,
    operationId,
  });
  assert.ok(receipt.ok && receipt.data?.status === "accepted");
  const run = await core.getRun({
    projectPath,
    serviceInstanceId,
    runId: receipt.data.runId,
  });
  assert.ok(run.ok);
  const all = await core.listRuns({ projectPath });
  assert.ok(all.ok);
  assert.deepEqual(
    all.data.map((item) => item.runId),
    [receipt.data.runId],
  );
  assert.equal(submissions, 1);
});

test("stale configuration revisions preserve the latest edit through the public Core", async (t) => {
  const projectPath = await projectFixture(t, false);
  const core = createCliCore();
  const initial = await core.readProjectConfig({ projectPath });
  assert.ok(initial.ok);
  const configuration = "intent: {apps: []}\n# latest user edit\n";
  const updated = await core.updateProjectConfig({
    projectPath,
    revision: initial.data.revision,
    configuration,
  });
  assert.ok(updated.ok);
  const stale = await core.updateProjectConfig({
    projectPath,
    revision: initial.data.revision,
    configuration: "intent: {apps: []}\n# stale edit\n",
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "CONFLICT");
  assert.equal(
    await readFile(join(projectPath, "intloom.yaml"), "utf8"),
    configuration,
  );
  const current = await core.readProjectConfig({ projectPath });
  assert.ok(current.ok);
  assert.equal(current.data.revision, updated.data.revision);
});

test("Core uses the independent Kernel process and shares full snapshots across clients", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const first = createCliCore();
  const second = createCliCore();
  const started = await first.startService({ projectPath });
  assert.equal(started.ok, true, JSON.stringify(started));
  if (!started.ok) return;
  const serviceInstanceId = started.data.service.instanceId;
  assert.notEqual(started.data.service.pid, process.pid);
  const operationId = randomUUID();
  const input = {
    projectPath,
    serviceInstanceId,
    operationId,
    flowName: "fixture",
    intent: "  preserve\n完整输入  ",
  };
  const [a, b] = await Promise.all([first.flow(input), second.flow(input)]);
  assert.ok(a.ok && b.ok, JSON.stringify({ a, b }));
  assert.equal(a.data.receipt.status, "accepted");
  assert.ok(a.data.run);
  const runId = a.data.run.runId;
  if (b.data.receipt.status === "accepted")
    assert.equal(b.data.receipt.runId, runId);
  const ready = await second.waitRun({
    projectPath,
    serviceInstanceId,
    runId,
    timeoutMs: 5000,
  });
  assert.ok(ready.ok, JSON.stringify(ready));
  assert.equal(ready.data.reason, "human_action");
  assert.equal(ready.data.run.status, "waiting");
  const other = await first.getRun({ projectPath, serviceInstanceId, runId });
  assert.ok(other.ok);
  assert.deepEqual(other.data, ready.data.run);
  const receipt = await second.getOperation({
    projectPath,
    serviceInstanceId,
    operationId,
  });
  assert.ok(receipt.ok && receipt.data?.status === "accepted");
  assert.equal(receipt.data.runId, runId);
  const conflict = await first.flow({ ...input, intent: "changed" });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "OPERATION_CONFLICT");
  const runs = await first.listRuns({ projectPath });
  assert.ok(runs.ok);
  assert.equal(runs.data.length, 1);
});

test("closing an observer or timing out never consumes a human action or cancels its Run", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const serviceInstanceId = started.data.service.instanceId;
  const created = await core.flow({
    projectPath,
    serviceInstanceId,
    operationId: randomUUID(),
    flowName: "fixture",
    intent: "wait",
  });
  assert.ok(created.ok && created.data.run);
  const runId = created.data.run.runId;
  for await (const event of core.watchRun({
    projectPath,
    serviceInstanceId,
    runId,
  })) {
    assert.ok(event.ok && event.data.type === "run_snapshot");
    break;
  }
  const waited = await core.waitRun({
    projectPath,
    serviceInstanceId,
    runId,
    until: "terminal",
    timeoutMs: 150,
  });
  assert.equal(waited.ok, false);
  if (!waited.ok) assert.equal(waited.error.code, "OBSERVATION_TIMEOUT");
  const snapshot = await core.getRun({ projectPath, serviceInstanceId, runId });
  assert.ok(snapshot.ok && snapshot.data.pendingAction);
  assert.equal(snapshot.data.status, "waiting");
  const failed = await core.answerAsk({
    projectPath,
    serviceInstanceId,
    runId,
    operationId: randomUUID(),
    actionId: snapshot.data.pendingAction.id,
    answer: [],
  });
  assert.equal(failed.ok, false);
  const unchanged = await core.getRun({
    projectPath,
    serviceInstanceId,
    runId,
  });
  assert.ok(unchanged.ok);
  assert.deepEqual(unchanged.data, snapshot.data);
});

test("project observation starts with a full snapshot; instance mismatch cannot create a Run or stop Service", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  for await (const event of core.watchProject({ projectPath })) {
    assert.ok(event.ok && event.data.type === "project_snapshot");
    assert.equal(event.data.serviceInstanceId, started.data.service.instanceId);
    assert.equal(event.data.runs.length, 0);
    break;
  }
  const wrong = randomUUID();
  const refused = await core.flow({
    projectPath,
    serviceInstanceId: wrong,
    operationId: randomUUID(),
    flowName: "fixture",
    intent: "never",
  });
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.error.code, "SERVICE_INSTANCE_CHANGED");
    assert.equal(refused.outcome, "not_applied");
  }
  const stop = await core.stopService({
    projectPath,
    serviceInstanceId: wrong,
  });
  assert.equal(stop.ok, false);
  const status = await core.getServiceStatus({ projectPath });
  assert.ok(status.ok && status.data.status === "running");
  const stopped = await core.stopService({
    projectPath,
    serviceInstanceId: started.data.service.instanceId,
  });
  assert.ok(stopped.ok && stopped.data.stopped);
  const offline = await core.getServiceStatus({ projectPath });
  assert.ok(offline.ok && offline.data.status === "stopped");
});

test("no model configuration is required for Service/Core queries", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t, false);
  const core = createCliCore();
  assert.ok((await core.startService({ projectPath })).ok);
  const result = await core.listWorkflows({ projectPath });
  assert.ok(result.ok);
  assert.deepEqual(result.data, []);
  assert.doesNotThrow(() => JSON.stringify(result));
  const rejected = await core.getRun({
    projectPath: "/nonexistent/intloom-probe",
    runId: "never",
  });
  assert.equal(rejected.ok, false);
  assert.doesNotThrow(() => JSON.stringify(rejected));
});
