import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createCliCore, startService, stopService } from "@intloom/cli";
import { projectFixture } from "./project-fixture.ts";

test("CLI receipts survive repeated queries and distinguish restarted instances from originating Run history", async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const first = await startService({ projectRoot: projectPath });
  const serviceInstanceId = first.service.instanceId;
  const operationId = randomUUID();
  const request = {
    projectPath,
    serviceInstanceId,
    operationId,
    loomName: "fixture",
    input: { prompt: "origin" },
  };
  const created = await core.run(request);
  assert.ok(created.ok);
  assert.equal(created.data.receipt.status, "accepted");
  if (created.data.receipt.status !== "accepted") throw new Error("No Run");
  const runId = created.data.receipt.runId;
  const duplicate = await core.run(request);
  assert.ok(duplicate.ok);
  assert.deepEqual(duplicate.data.receipt, created.data.receipt);
  const stopped = await core.cancelRun({
    projectPath,
    serviceInstanceId,
    runId,
    operationId: randomUUID(),
  });
  assert.ok(stopped.ok);
  await stopService(projectPath);
  await startService({ projectRoot: projectPath });
  const receipt = await core.getOperation({
    projectPath,
    serviceInstanceId,
    operationId,
  });
  assert.ok(receipt.ok);
  assert.equal(receipt.data.status, "instance_changed");
  const history = await core.findRun({
    projectPath,
    originatingInstanceId: serviceInstanceId,
    operationId,
  });
  assert.ok(history.ok);
  assert.equal(history.data?.runId, runId);
  assert.equal(history.data?.historical, true);
  const stale = await core.run(request);
  assert.equal(stale.ok, false);
  const all = await core.listRuns({ projectPath });
  assert.ok(all.ok);
  assert.equal(all.data.length, 1);
});
