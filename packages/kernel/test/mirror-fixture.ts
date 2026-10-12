import type { TestContext } from "node:test";
import { join } from "node:path";
import { initializationProject } from "./initialization-fixture.ts";
import { initializeProject } from "../src/core/initialize-project.ts";
import { createEffector } from "../src/effector/create-effector.ts";
import { openFileStorage } from "../src/storage/file/open.ts";
import { openSqliteStorage } from "../src/storage/sqlite/open.ts";
import { createRuntimeObservation } from "../src/runtime/run-observation.ts";
import { testConfig } from "./agent-fixture.ts";
import { randomUUID } from "node:crypto";
import type { ProjectExecution } from "../src/core/contracts.ts";
import type { StorageHandle } from "../src/storage/contracts.ts";
import { setTimeout } from "node:timers/promises";

export function mirrorWorkflow(
  options: {
    delta?: number;
    invalidSchema?: boolean;
    failInit?: boolean;
    reenter?: boolean;
    clear?: boolean;
  } = {},
): string {
  return `import * as z from 'zod';
export const blueprint={flowName:'mirror-case',entryStageName:'first',stages:{
 first:{stageName:'first',initializeState:ctx=>{${options.failInit ? "throw new Error('init failed');" : "return {n:0,runId:ctx.runId};"}},stateSchema:z.strictObject({n:z.number(),runId:z.string()${options.invalidSchema ? ",added:z.string().default('changed')" : ""}}),entryStepName:'work',steps:{work:{stepName:'work',execution:{kind:'code',codeId:'CODE-abcdefghijklmnopqrstu'},on:{loop:{kind:'step',stepName:'work'},done:{kind:'stage_end'}}}},on:{done:{kind:'stage',stageName:'second'}}},
 second:{stageName:'second',initializeState:ctx=>({upstream:true,runId:ctx.runId}),stateSchema:z.strictObject({upstream:z.boolean(),runId:z.string()}),entryStepName:'finish',steps:{finish:{stepName:'finish',execution:{kind:'code',codeId:'CODE-bbcdefghijklmnopqrstu'},on:{done:{kind:'stage_end'},again:{kind:'stage_end'}}}},on:{done:{kind:'workflow_end'},again:{kind:'stage',stageName:'first'}}}
}};
export const codes={
 'CODE-abcdefghijklmnopqrstu':async (_input,a)=>{
  const state=a.state.value; const n=state.n+${options.delta ?? 1};
  await a.state.update({...state,n});
  await a.project.write('src/value.json',JSON.stringify({n}));
  const built=await a.project.run({command:process.execPath,args:['--eval',"const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/value.txt','"+n+"');"]});if(built.exitCode!==0)throw new Error('local build failed');
  const artifact=await a.storage.getArtifact('mirror-case','first');
  await a.storage.commit([{type:artifact?'replace_artifact':'create_artifact',id:artifact?.id??'upstream',...(artifact?{expectedRevision:artifact.revision}:{}),payload:{flowName:'mirror-case',stageName:'first',data:{runId:state.runId,n}}},{type:'append_record',id:state.runId+'-'+n,payload:{flowName:'mirror-case',stageName:'first',data:{runId:state.runId,n}}}]);
  ${options.clear ? "await a.state.clear();" : ""}
  return {outcome:n<2?'loop':'done'};
 },
 'CODE-bbcdefghijklmnopqrstu':async (_input,a)=>{
  const up=await a.storage.getArtifact('mirror-case','first');
  if(!a.state.value.upstream||up.data.runId!==a.state.value.runId)throw new Error('upstream reference lost');
  if(JSON.parse(await a.project.read('src/value.json')).n!==up.data.n)throw new Error('file mismatch');
  await a.storage.commit([{type:'append_record',id:'finished-'+a.state.value.runId,payload:{flowName:'mirror-case',stageName:'second',data:{artifactId:up.id,revision:up.revision,runId:a.state.value.runId}}}]);
  return {outcome:${options.reenter ? "(await a.storage.listRecords({stageName:'first'})).data.length<4?'again':'done'" : "'done'"}};
 }
};export const agentSpecs={};`;
}
const openHosts = new Map<string, () => Promise<void>>();
export async function mirrorProject(
  t: TestContext,
  backend: "file" | "sqlite",
  body = mirrorWorkflow(),
) {
  const cleanups: (() => Promise<void>)[] = [];
  const project = await initializationProject({
    after: (cleanup: () => Promise<void>) => cleanups.push(cleanup),
  } as unknown as TestContext);
  t.after(async () => {
    await openHosts.get(project.root)?.();
    openHosts.delete(project.root);
    for (const cleanup of cleanups) await cleanup();
  });
  const workflowRoot = await project.add("mirror-fixture", body);
  await project.configure({
    ...testConfig(),
    useMcpAgent: false,
    localStorage: backend,
    mirror: { enabled: true, files: { include: ["dist/**"] } },
  });
  return { ...project, workflowRoot };
}
export async function openMirrorProject(
  root: string,
  backend: "file" | "sqlite",
) {
  const storage =
    backend === "file"
      ? await openFileStorage({
          directory: join(root, "intloom"),
          layout: "directories",
        })
      : await openSqliteStorage({
          filename: join(root, "intloom/storage.sqlite"),
          projectId: "project",
        });
  const execution = await initializeProject(root, {
    storage: storage.access,
    storageHandle: storage,
    effector: createEffector(),
    runtimeDirectory: join(root, ".intloom/runtime"),
    observation: createRuntimeObservation({ serviceInstanceId: randomUUID() }),
  });
  if (!execution.registries.blueprints["mirror-case"]) {
    await storage.dispose();
    throw new Error(
      JSON.stringify(
        execution.workflows.map((w) =>
          w.isAvailable
            ? w
            : {
                ...w,
                error: {
                  message: w.error.message,
                  cause: String(w.error.cause),
                },
              },
        ),
      ),
    );
  }
  const host = {
    storage,
    execution,
    async close() {
      await execution.runtime.suspend();
      await storage.dispose();
    },
  };
  openHosts.set(root, host.close);
  return host;
}
export async function stable(execution: ProjectExecution, runId: string) {
  for (
    const deadline = performance.now() + 20000;
    performance.now() < deadline;
  ) {
    const run = await execution.runtime.getRun(runId);
    if (run.status !== "running" && run.settled) return run;
    await setTimeout(10);
  }
  throw new Error(
    "Run did not reach a settled stable state: " +
      JSON.stringify(await execution.runtime.getRun(runId)),
  );
}
export async function snapshot(storage: StorageHandle) {
  if (!storage.exportSnapshot) throw new Error("missing snapshot");
  return storage.exportSnapshot();
}
