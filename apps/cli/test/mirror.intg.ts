import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { createCliCore } from "@intloom/cli";
import type { MirrorManifest } from "@intloom/kernel";
import {
  cli,
  projectFixture,
  configureProject,
  refreshFixtureInstallation,
  mcpClient,
} from "./project-fixture.ts";

function workflow(delta = 1) {
  return `import * as z from 'zod';
export const blueprint={flowName:'tiny-mirror',entryStageName:'first',stages:{first:{stageName:'first',initializeState:ctx=>({n:0,runId:ctx.runId}),stateSchema:z.strictObject({n:z.number(),runId:z.string()}),entryStepName:'one',steps:{one:{stepName:'one',execution:{kind:'code',codeId:'CODE-123456789012345678901'},on:{done:{kind:'step',stepName:'two'}}},two:{stepName:'two',execution:{kind:'code',codeId:'CODE-123456789012345678901'},on:{done:{kind:'stage_end'}}}},on:{done:{kind:'workflow_end'}}}}};
export const codes={'CODE-123456789012345678901':async(_input,a)=>{const state=a.state.value,n=state.n+${delta};await a.state.update({...state,n});await a.project.write('result.txt',String(n));await a.storage.commit([{type:'append_record',id:state.runId+'-'+n,payload:{flowName:'tiny-mirror',stageName:'first',data:{n}}}]);return {outcome:'done'};}};export const agentSpecs={};`;
}
for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: actual CLI, independent host, shared operation receipts and MCP mirror controls`, {
    timeout: 60000,
  }, async (t) => {
    const source = await projectFixture(t, true, backend);
    const target = await projectFixture(t, true, backend);
    async function prepare(root: string, delta: number) {
      await configureProject(root, {
        mirror: { enabled: true },
        useMcpAgent: false,
      });
      await writeFile(
        join(
          root,
          ".intloom/workflows/node_modules/fixture-workflow/workflow.js",
        ),
        workflow(delta),
      );
      await refreshFixtureInstallation(root);
    }
    await prepare(source, 1);
    await prepare(target, 5);
    const core = createCliCore();
    const started = await core.startService({ projectPath: source });
    assert.ok(started.ok, JSON.stringify(started));
    const admitted = await core.flow({
      projectPath: source,
      serviceInstanceId: started.data.service.instanceId,
      operationId: randomUUID(),
      flowName: "tiny-mirror",
      intent: "deterministic CLI tiny project",
    });
    assert.ok(admitted.ok && admitted.data.run);
    const runId = admitted.data.run.runId;
    const done = await core.waitRun({
      projectPath: source,
      runId,
      until: "terminal",
      timeoutMs: 10000,
    });
    assert.ok(done.ok);
    assert.equal(done.data.run.status, "completed");
    assert.ok((await core.stopService({ projectPath: source })).ok);
    const listed = await cli(source, ["mirror", "list", "--json"]);
    assert.equal(listed.code, 0, listed.stdout + listed.stderr);
    const images = JSON.parse(listed.stdout).data as MirrorManifest[];
    assert.equal(images.length, 9);
    const before = images.find(
      (x) => x.boundary.kind === "step_before" && x.boundary.stepVisitId === 1,
    );
    assert.ok(before);
    const after = images.find(
      (x) => x.boundary.kind === "step_after" && x.boundary.stepVisitId === 1,
    );
    assert.ok(after);
    const inspected = JSON.parse(
      (await cli(source, ["mirror", "inspect", before.mirrorId, "--json"]))
        .stdout,
    );
    assert.equal(inspected.data.integrity.valid, true);
    const rejected = await cli(source, [
      "mirror",
      "restore",
      after.mirrorId,
      "--to",
      target,
      "--scope",
      "step",
      "--json",
    ]);
    assert.equal(rejected.code, 1);
    assert.equal(
      JSON.parse(rejected.stdout).error.code,
      "MIRROR_RESTORE_FAILED",
    );
    const restored = await cli(source, [
      "mirror",
      "restore",
      before.mirrorId,
      "--to",
      target,
      "--scope",
      "step",
      "--json",
    ]);
    assert.equal(restored.code, 0, restored.stdout + restored.stderr);
    assert.equal(JSON.parse(restored.stdout).data.status, "paused");
    let branch = await core.startService({ projectPath: target });
    assert.ok(branch.ok, JSON.stringify(branch));
    let paused = await core.getRun({ projectPath: target, runId });
    assert.ok(paused.ok);
    assert.equal(paused.data.status, "paused");
    const args = [
      "run",
      "resume",
      runId,
      "--instance",
      branch.data.service.instanceId,
      "--revision",
      String(paused.data.revision),
      "--operation-id",
      randomUUID(),
      "--json",
    ];
    const first = JSON.parse((await cli(target, args)).stdout);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.data.receipt.kind, "resume");
    const stopped = await core.waitRun({
      projectPath: target,
      runId,
      timeoutMs: 10000,
    });
    assert.ok(stopped.ok);
    assert.equal(stopped.data.reason, "paused");
    assert.equal(await readFile(join(target, "result.txt"), "utf8"), "5");
    const duplicate = JSON.parse((await cli(target, args)).stdout);
    assert.deepEqual(duplicate.data.receipt, first.data.receipt);
    assert.equal(await readFile(join(target, "result.txt"), "utf8"), "5");
    assert.ok((await core.stopService({ projectPath: target })).ok);
    branch = await core.startService({ projectPath: target });
    assert.ok(branch.ok);
    paused = await core.getRun({ projectPath: target, runId });
    assert.ok(paused.ok);
    assert.equal(paused.data.status, "paused");
    const { client } = await mcpClient(t, target);
    const tools = await client.listTools();
    for (const name of [
      "mirror_list",
      "mirror_inspect",
      "mirror_restore",
      "mirror_export",
      "resume_run",
    ])
      assert.ok(tools.tools.some((x) => x.name === name));
    const mirrorList = await client.callTool({
      name: "mirror_list",
      arguments: {},
    });
    assert.equal(mirrorList.isError, undefined);
    const operationId = randomUUID();
    const request = {
      runId,
      operationId,
      scope: "workflow",
      expectedRevision: paused.data.revision,
      serviceInstanceId: branch.data.service.instanceId,
    };
    const resumed = await client.callTool({
      name: "resume_run",
      arguments: request,
    });
    assert.equal(resumed.isError, undefined, JSON.stringify(resumed));
    const final = await core.waitRun({
      projectPath: target,
      runId,
      until: "terminal",
      timeoutMs: 10000,
    });
    assert.ok(final.ok);
    assert.equal(final.data.run.status, "completed");
    assert.equal(await readFile(join(target, "result.txt"), "utf8"), "10");
    const repeated = await client.callTool({
      name: "resume_run",
      arguments: request,
    });
    assert.deepEqual(repeated.structuredContent, resumed.structuredContent);
    await client.close();
    assert.ok((await core.stopService({ projectPath: target })).ok);
  });
