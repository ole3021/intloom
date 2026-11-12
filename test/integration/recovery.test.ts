import { writeFixturePackage } from "./fixture-package.ts";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  mkdtemp,
  mkdir,
  symlink,
  writeFile,
  rename,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { serve, type Kernel } from "../../packages/kernel/dist/index.js";
const root = fileURLToPath(new URL("../../", import.meta.url));
const req = createRequire(join(root, "packages/kernel/package.json"));
const { createClient } = await import(
  pathToFileURL(req.resolve("@libsql/client")).href
);
const hasCode = (code: string) => (error: unknown) =>
  (error as { code?: string }).code === code;
async function fixture(t: TestContext, source: (directory: string) => string) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const author = join(directory, "author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(
    join(author, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        types: ["node"],
        typeRoots: [join(root, "node_modules/@types")],
      },
    }),
  );
  await writeFile(join(author, "loom.ts"), source(directory));
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(directory, "compiled"),
    target: "node22",
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  return { directory, compiled, dataDir: join(directory, "data") };
}
async function settled(host: Kernel, id: string) {
  for (let i = 0; i < 500; i++) {
    const view = await host.getRun(id);
    if (!["created", "running", "stopping"].includes(view.status)) return view;
    await delay(10);
  }
  throw new Error("Run did not settle");
}
const simple = (directory: string) => `
import {appendFileSync} from 'node:fs';
import {defineLoom,defineWorkflow,defineStep,withDefault} from '@intloom/loom-sdk';
import {z} from 'zod';
const mark=(text:string)=>appendFileSync(${JSON.stringify(join(directory, "effects"))},text+'\\n');
const before=defineStep({id:'before',inputSchema:z.number(),outputSchema:z.number(),execute:({inputData})=>{mark('before');return inputData+1;}});
const wait=defineStep({id:'wait',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.object({message:z.string()}),resumeSchema:z.object({value:withDefault(z.number(),3)}),
interaction:{message:({suspendData})=>{mark('projection');return suspendData.message;}},
execute:async({inputData,suspend,resumeData,suspendData})=>{if(!resumeData)return suspend({message:'Continue?'});mark('resume:'+resumeData.value+':'+suspendData?.message);return inputData+resumeData.value;}});
export default defineLoom({id:'recovery-wait',version:'1.0.0',description:'durable wait',entry:defineWorkflow({id:'main',inputSchema:z.number(),outputSchema:z.number()}).then(before).then(wait).commit()});`;
function phase(
  directory: string,
  mode: string,
  artifact = "compiled",
  ...args: string[]
) {
  const result = spawnSync(
    process.execPath,
    [
      join(root, "test/integration/fixtures/recovery-process.mjs"),
      join(root, "packages/kernel/package.json"),
      directory,
      mode,
      artifact,
      ...args,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(
    result.status,
    0,
    `${mode}: ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
}
async function readView(directory: string) {
  return JSON.parse(await readFile(join(directory, "view.json"), "utf8"));
}
async function clearTrigger(dataDir: string, name: string) {
  const run = JSON.parse(await readFile(join(dataDir, "../run.json"), "utf8"));
  const db = createClient({
    url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
  });
  await db.execute(`DROP TRIGGER ${name}`);
  db.close();
}
test("REC01/02/03 real process restart preserves waits, projections and accepted defaults without replay", async (t) => {
  for (const scenario of [
    "normal",
    "unpublished",
    "answer_saved",
    "completed_unpublished",
  ]) {
    const { directory, dataDir } = await fixture(t, simple);
    phase(directory, scenario === "unpublished" ? "unpublished" : "start");
    if (scenario === "unpublished") await clearTrigger(dataDir, "fail_wait");
    phase(directory, "inspect");
    const initial = await readView(directory);
    assert.equal(initial.run.status, "waiting");
    assert.equal(initial.interactions.length, 1);
    assert.equal(
      await readFile(join(directory, "effects"), "utf8"),
      "before\nprojection\n",
    );
    if (scenario === "answer_saved") {
      phase(directory, "answer_saved");
      await clearTrigger(dataDir, "fail_resume");
      phase(directory, "inspect");
      const saved = await readView(directory);
      assert.equal(saved.interactions[0].status, "answered");
      assert.equal(saved.interactions[0].id, initial.interactions[0].id);
      phase(directory, "resume");
    } else if (scenario === "completed_unpublished") {
      phase(directory, "completed_unpublished");
      await clearTrigger(dataDir, "fail_complete");
      phase(directory, "inspect");
    } else phase(directory, "answer");
    const final = await readView(directory);
    assert.equal(final.run.id, initial.run.id);
    assert.equal(final.run.status, "succeeded", JSON.stringify(final));
    assert.equal(final.run.output, 5);
    assert.equal(
      await readFile(join(directory, "effects"), "utf8"),
      "before\nprojection\nresume:3:Continue?\n",
    );
  }
});
test("an upgrade continues a committed answer once across Kernel versions", async (t) => {
  const { directory, dataDir } = await fixture(t, simple);
  phase(directory, "start");
  phase(directory, "answer_saved");
  await clearTrigger(dataDir, "fail_resume");
  const { id, location } = JSON.parse(
    await readFile(join(directory, "run.json"), "utf8"),
  );
  const db = createClient({
    url: pathToFileURL(join(location.dataDir, "kernel.db")).href,
  });
  await db.execute({
    sql: "UPDATE runs SET record = json_set(record, '$.binding.runtime.version', '0.3.0') WHERE id = ?",
    args: [id],
  });
  db.close();
  const upgraded = await serve({ dataDir, recoverUpgrade: true });
  try {
    const done = await settled(upgraded, id);
    assert.equal(done.status, "succeeded", JSON.stringify(done));
    assert.equal(done.output, 5);
    assert.equal(
      await readFile(join(directory, "effects"), "utf8"),
      "before\nprojection\nresume:3:Continue?\n",
    );
  } finally {
    await upgraded.close();
  }
});
test("interaction actions, human policy, invalid answers, false, closure and duplicate resume", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';
 const wait=defineStep({id:'wait',inputSchema:z.boolean(),outputSchema:z.boolean(),suspendSchema:z.string(),resumeSchema:z.boolean(),interaction:{message:({suspendData})=>suspendData,responsePolicy:'human'},execute:async({resumeData,suspend})=>resumeData===undefined?suspend('Approve?'):resumeData});
 export default defineLoom({id:'recovery-human',version:'1.0.0',description:'human',entry:defineWorkflow({id:'main',inputSchema:z.boolean(),outputSchema:z.boolean()}).then(wait).commit()});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: true });
  await host.startRun(run.id);
  await settled(host, run.id);
  const [request] = await host.listInteractions({ runId: run.id });
  assert.ok(request);
  const human = { source: { kind: "human" as const, via: "api" as const } },
    program = { source: { kind: "program" as const, via: "api" as const } };
  for (const action of ["decline", "dismiss"] as const)
    assert.equal(
      (await host.respondInteraction(request.id, { action }, program))
        .continuation.status,
      "not_requested",
    );
  await assert.rejects(
    host.respondInteraction(
      request.id,
      { action: "submit", value: false },
      program,
    ),
    hasCode("RESPONSE_SOURCE_NOT_ALLOWED"),
  );
  await assert.rejects(
    host.respondInteraction(request.id, { action: "submit", value: 3 }, human),
    hasCode("RESPONSE_INVALID"),
  );
  const pendingWait = (await host.getRun(run.id)).waits[0];
  assert.ok(pendingWait);
  await assert.rejects(
    host.resumeRun({
      runId: run.id,
      waitId: pendingWait.waitId,
      resumeData: false,
    }),
    hasCode("INVALID_ARGUMENT"),
  );
  await host.respondInteraction(
    request.id,
    { action: "submit", value: false },
    human,
  );
  const done = await settled(host, run.id);
  assert.equal(done.status, "succeeded", JSON.stringify(done));
  assert.equal(done.output, false);
  assert.equal((await host.getInteraction(request.id)).responses.length, 3);
  await assert.rejects(
    host.respondInteraction(
      request.id,
      { action: "submit", value: true },
      human,
    ),
    hasCode("INTERACTION_NOT_ANSWERABLE"),
  );
  assert.equal(
    (await host.resumeRun({ runId: run.id, requestId: request.id }))
      .disposition,
    "no_change",
  );
  const second = await host.createRun({ loom: ref, input: true });
  await host.startRun(second.id);
  await settled(host, second.id);
  const [pending] = await host.listInteractions({ runId: second.id });
  assert.ok(pending);
  await host.cancelRun(second.id);
  assert.equal(
    (await host.getInteraction(pending.id)).request.status,
    "closed",
  );
});
test("REC06 parallel waits in foreach nested Workflow retain four identities and route concurrent answers once", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';
 const waiting=<const Id extends string>(id:Id)=>defineStep({id,inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),resumeSchema:z.number(),interaction:{message:({suspendData})=>id+':'+suspendData},execute:async({inputData,resumeData,suspend})=>{if(resumeData===undefined)return suspend(inputData);await new Promise(resolve=>setTimeout(resolve,25));return inputData+resumeData;}});
 const inner=defineWorkflow({id:'inner',inputSchema:z.number(),outputSchema:z.object({a:z.number(),b:z.number()})}).parallel([waiting('a'),waiting('b')]).commit();
 export default defineLoom({id:'recovery-parallel',version:'1.0.0',description:'parallel',entry:defineWorkflow({id:'main',inputSchema:z.array(z.number()),outputSchema:z.array(z.object({a:z.number(),b:z.number()}))}).foreach(defineStep(inner,{id:'nested'}),{concurrency:2}).commit()});`,
  );
  let host = await serve({ dataDir });
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: [1, 2] });
  await host.startRun(run.id);
  let view = await settled(host, run.id);
  assert.equal(view.status, "waiting", JSON.stringify(view));
  const requests = await host.listInteractions({ runId: run.id });
  assert.equal(requests.length, 4);
  assert.equal(new Set(requests.map((r) => r.id)).size, 4);
  const eventQuery = { runId: run.id, limit: 100 };
  const events = await host.listRunEvents(eventQuery);
  for (let i = 0; i < 2; i++) {
    await host.close();
    host = await serve({ dataDir });
    assert.deepEqual(await host.getRun(run.id), view);
    assert.deepEqual(await host.listRunEvents(eventQuery), events);
  }
  t.after(() => host.close());
  assert.deepEqual(await host.listInteractions({ runId: run.id }), requests);
  const receipts = await Promise.all(
    requests.map((request, index) =>
      host.respondInteraction(
        request.id,
        { action: "submit", value: (index + 1) * 10 },
        { source: { kind: "test", via: "api" } },
      ),
    ),
  );
  assert.ok(
    receipts.every((r) => r.continuation.status === "requested"),
    JSON.stringify(receipts),
  );
  for (let i = 0; i < 200; i++) {
    view = await host.getRun(run.id);
    if (view.status === "succeeded" || view.status === "failed") break;
    await delay(10);
  }
  assert.equal(view.status, "succeeded", JSON.stringify(view));
  const expected = [
    { a: 0, b: 0 },
    { a: 0, b: 0 },
  ];
  requests.forEach((r, index) => {
    const [id, num] = r.message.split(":");
    const number = Number(num);
    const row = expected[number - 1];
    assert.ok(row);
    row[id as "a" | "b"] = number + (index + 1) * 10;
  });
  assert.deepEqual(view.output, expected);
  assert.ok(
    (await host.listInteractions({ runId: run.id })).every(
      (r) => r.status === "answered",
    ),
  );
});
test("external waits accept data once, preserve undefined resumes, and stable waits await every active branch", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';
 const wait=defineStep({id:'wait',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.string(),resumeSchema:z.number(),execute:async({resumeData,suspend})=>resumeData===undefined?suspend('external'):resumeData});
 const slow=defineStep({id:'slow',inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData})=>{await new Promise(resolve=>setTimeout(resolve,150));return inputData;}});
 export default defineLoom({id:'recovery-external',version:'1.0.0',description:'external',entry:defineWorkflow({id:'main',inputSchema:z.number(),outputSchema:z.object({wait:z.number(),slow:z.number()})}).parallel([wait,slow]).commit()});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: 1 });
  await host.startRun(run.id);
  await delay(40);
  assert.equal((await host.getRun(run.id)).status, "running");
  assert.deepEqual(await host.listInteractions({ runId: run.id }), []);
  const view = await settled(host, run.id);
  assert.equal(view.waits.length, 1);
  const wait = view.waits[0];
  assert.ok(wait);
  await assert.rejects(
    host.resumeRun({ runId: run.id, waitId: wait.waitId, resumeData: "bad" }),
    hasCode("INPUT_INVALID"),
  );
  const beforeAnswer = new Date().toISOString();
  await host.resumeRun({ runId: run.id, waitId: wait.waitId, resumeData: 8 });
  const accepted = (
    await host.listRunEvents({ runId: run.id, limit: 100 })
  ).items.find((event) => event.type === "wait.accepted");
  assert.ok(accepted && accepted.time >= beforeAnswer);
  const done = await settled(host, run.id);
  assert.deepEqual(done.output, { wait: 8, slow: 1 });
  assert.equal(
    (await host.resumeRun({ runId: run.id, waitId: wait.waitId })).disposition,
    "no_change",
  );
});
test("REC04 a killed claimed resume becomes interrupted and never replays the accepted answer", async (t) => {
  const { directory, dataDir } = await fixture(t, (directory) =>
    simple(directory).replace(
      "return inputData+resumeData.value;",
      "await new Promise<void>(()=>{setInterval(()=>{},1000)});return inputData+resumeData.value;",
    ),
  );
  phase(directory, "start");
  const initial = await readView(directory);
  const child = spawn(
    process.execPath,
    [
      join(root, "test/integration/fixtures/recovery-process.mjs"),
      join(root, "packages/kernel/package.json"),
      directory,
      "answer",
    ],
    { stdio: "pipe" },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  let executed = false;
  for (let i = 0; i < 300; i++) {
    if (
      (await readFile(join(directory, "effects"), "utf8")).includes("resume:")
    ) {
      executed = true;
      break;
    }
    await delay(10);
  }
  assert.ok(executed);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGKILL");
  await exited;
  phase(directory, "inspect");
  const view = await readView(directory);
  assert.equal(view.run.status, "interrupted");
  assert.equal(view.interactions[0].status, "answered");
  const host = await serve({ dataDir });
  t.after(() => host.close());
  await assert.rejects(
    host.resumeRun({
      runId: initial.run.id,
      requestId: initial.interactions[0].id,
    }),
    hasCode("RUN_STATE_INVALID"),
  );
  assert.equal(
    await readFile(join(directory, "effects"), "utf8"),
    "before\nprojection\nresume:3:Continue?\n",
  );
});
async function parentFixture(t: TestContext, source = simple) {
  const result = await fixture(t, source);
  const host = await serve({ dataDir: result.dataDir });
  await host.installLoom({ source: result.compiled.artifactDir });
  const catalog = await host.getLoomCatalog();
  await host.close();
  const author = join(result.directory, "parent");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(
    join(author, "loom.ts"),
    `import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';import {child} from './.intloom/dependencies.ts';export default defineLoom({id:'recovery-parent',dependencies:{child:{id:'recovery-wait',version:'1.0.0'}},version:'1.0.0',description:'parent',entry:defineWorkflow({id:'parent',inputSchema:z.number(),outputSchema:z.number()}).then(defineStep(child,{id:'call'})).commit()});`,
  );
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(result.directory, "parent-compiled"),
    target: "node22",
    catalog,
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  return { ...result, parent: compiled };
}
test("REC07 separate child Runs survive restart and completed children are reused by explicit parent resume", async (t) => {
  const { directory, dataDir } = await parentFixture(t);
  phase(directory, "start", "parent-compiled");
  const initial = await readView(directory);
  assert.equal(initial.run.status, "waiting", JSON.stringify(initial));
  assert.equal(initial.run.waits[0].kind, "child");
  const childId = initial.run.waits[0].childRunId;
  phase(directory, "inspect");
  assert.deepEqual((await readView(directory)).run.waits, initial.run.waits);
  let host = await serve({ dataDir });
  assert.equal((await host.getRun(childId)).parentRunId, initial.run.id);
  const parentEvents = (
    await host.listRunEvents({ runId: initial.run.id, limit: 100 })
  ).items;
  const linked = parentEvents.find((event) => event.type === "child.created");
  assert.ok(linked);
  assert.equal(linked.details.childRunId, childId);
  assert.ok(linked.executionId && linked.details.callId);
  const childEvents = (await host.listRunEvents({ runId: childId, limit: 100 }))
    .items;
  assert.equal(childEvents[0]?.type, "run.created");
  assert.equal(childEvents[0]?.seq, 1);
  assert.equal(childEvents[0]?.time, linked.time);
  const [request] = await host.listInteractions({ runId: childId });
  assert.ok(request);
  await host.respondInteraction(
    request.id,
    { action: "submit", value: {} },
    { source: { kind: "test", via: "api" } },
  );
  await host.close();
  host = await serve({ dataDir });
  t.after(() => host.close());
  assert.equal((await host.getRun(childId)).status, "succeeded");
  assert.equal((await host.getRun(initial.run.id)).status, "waiting");
  await host.resumeRun({
    runId: initial.run.id,
    waitId: initial.run.waits[0].waitId,
  });
  const done = await settled(host, initial.run.id);
  assert.equal(done.status, "succeeded", JSON.stringify(done));
  assert.equal(done.output, 5);
  assert.equal(
    (await host.listRuns({ parentRunId: initial.run.id })).items.length,
    1,
  );
  assert.equal(
    await readFile(join(directory, "effects"), "utf8"),
    "before\nprojection\nresume:3:Continue?\n",
  );
});
test("REC07/08 cancelling a parent stops its owned child and waits for the non-cooperative child to settle", async (t) => {
  const { parent, dataDir } = await parentFixture(
    t,
    () =>
      `import {defineCode,defineLoom} from '@intloom/loom-sdk';import {z} from 'zod';export default defineLoom({id:'recovery-wait',version:'1.0.0',description:'slow child',entry:defineCode({id:'slow',inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData,context})=>{context.logger.info('child-start');await new Promise(resolve=>setTimeout(resolve,180));context.logger.info('child-end');return inputData;}})});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: parent.artifactDir });
  const run = await host.createRun({ loom: ref, input: 1 });
  await host.startRun(run.id);
  let childId = "";
  for (let i = 0; i < 200; i++) {
    childId = (await host.listRuns({ parentRunId: run.id })).items[0]?.id ?? "";
    if (
      childId &&
      (await host.listRunEvents({ runId: childId })).items.some(
        (e) =>
          (e.type === "log" ? e.details.message : undefined) === "child-start",
      )
    )
      break;
    await delay(5);
  }
  assert.ok(childId);
  assert.equal((await host.cancelRun(run.id)).run.status, "stopping");
  await delay(30);
  assert.equal((await host.getRun(run.id)).status, "stopping");
  assert.equal((await host.getRun(childId)).status, "stopping");
  assert.equal((await settled(host, run.id)).status, "cancelled");
  assert.equal((await host.getRun(childId)).status, "cancelled");
  assert.ok(
    (await host.listRunEvents({ runId: childId })).items.some(
      (e) => (e.type === "log" ? e.details.message : undefined) === "child-end",
    ),
  );
});
test("REC09 incompatible engine binding keeps a waiting Run visible and blocks execution until restored", async (t) => {
  const { directory, dataDir } = await fixture(t, simple);
  phase(directory, "start");
  const initial = await readView(directory);
  const db = createClient({
    url: pathToFileURL(join(initial.run.location.dataDir, "kernel.db")).href,
  });
  await db.execute(
    "UPDATE runs SET record=json_set(record, '$.binding.runtime.engineVersion', 'incompatible')",
  );
  db.close();
  phase(directory, "inspect");
  const view = await readView(directory);
  assert.equal(view.run.status, "waiting");
  assert.equal(view.run.recoveryIssue.code, "BINDING_MISMATCH");
  assert.equal(
    await readFile(join(directory, "effects"), "utf8"),
    "before\nprojection\n",
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  await assert.rejects(
    host.respondInteraction(
      initial.interactions[0].id,
      { action: "submit", value: {} },
      { source: { kind: "test", via: "api" } },
    ),
    hasCode("BINDING_MISMATCH"),
  );
  assert.equal(
    (await host.getInteraction(initial.interactions[0].id)).request.status,
    "pending",
  );
});
test("REC06 native resume labels route distinct outer and inner foreach indices without broadcasting an answer", async (t) => {
  const { compiled, dataDir, directory } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';
 const wait=defineStep({id:'ask',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),resumeSchema:z.number(),interaction:{message:({suspendData})=>String(suspendData)},execute:async({inputData,resumeData,suspend})=>resumeData===undefined?suspend(inputData):resumeData});
 const inner=defineWorkflow({id:'inner',inputSchema:z.array(z.number()),outputSchema:z.array(z.number())}).foreach(wait,{concurrency:2}).commit();
 export default defineLoom({id:'recovery-matrix',version:'1.0.0',description:'nested iterations',entry:defineWorkflow({id:'outer',inputSchema:z.array(z.array(z.number())),outputSchema:z.array(z.array(z.number()))}).foreach(defineStep(inner,{id:'inner'}),{concurrency:2}).commit()});`,
  );
  let host = await serve({ dataDir });
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({
    loom: ref,
    input: [
      [1, 2],
      [3, 4],
    ],
  });
  await host.startRun(run.id);
  assert.equal((await settled(host, run.id)).waits.length, 4);
  const requests = await host.listInteractions({ runId: run.id });
  await writeFile(join(directory, "run.json"), JSON.stringify(run));
  for (const value of [2, 3, 1, 4]) {
    await host.close();
    const request = requests.find((r) => r.message === String(value));
    assert.ok(request);
    phase(directory, "answer", "compiled", String(value * 10), request.id);
    host = await serve({ dataDir });
    const view = await settled(host, run.id);
    assert.ok(
      ["waiting", "succeeded"].includes(view.status),
      JSON.stringify(view),
    );
  }
  t.after(() => host.close());
  assert.deepEqual((await host.getRun(run.id)).output, [
    [10, 20],
    [30, 40],
  ]);
});
test("loops publish a new wait instance per iteration and external no-data waits resume using original suspend data", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep} from '@intloom/loom-sdk';import {z} from 'zod';
 const wait=defineStep({id:'repeat',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),execute:async({inputData,suspendData,suspend})=>suspendData===undefined?suspend(inputData):suspendData+1});
 export default defineLoom({id:'recovery-loop',version:'1.0.0',description:'loops',entry:defineWorkflow({id:'main',inputSchema:z.number(),outputSchema:z.number()}).dowhile(wait,({inputData})=>inputData<3).commit()});`,
  );
  let host = await serve({ dataDir });
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: 0 });
  await host.startRun(run.id);
  let view = await settled(host, run.id);
  const ids = new Set<string>();
  for (let i = 0; i < 3; i++) {
    assert.equal(view.status, "waiting", JSON.stringify(view));
    const wait = view.waits[0];
    assert.ok(wait);
    assert.ok(!ids.has(wait.waitId));
    ids.add(wait.waitId);
    await host.close();
    host = await serve({ dataDir });
    await host.resumeRun({ runId: run.id, waitId: wait.waitId });
    view = await settled(host, run.id);
  }
  t.after(() => host.close());
  assert.equal(view.status, "succeeded");
  assert.equal(view.output, 3);
});
test("REC09 missing bindings and credentials preserve answers; restoring the original binding resumes with rotated credentials", async (t) => {
  const { compiled, dataDir } = await fixture(
    t,
    () => `
 import {defineLoom,defineWorkflow,defineStep,defineTool,withDefault} from '@intloom/loom-sdk';import {z} from 'zod';
 const wait=defineStep({id:'ask',inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.string(),resumeSchema:z.object({value:withDefault(z.number(),3)}),interaction:{message:({suspendData})=>suspendData},execute:async({resumeData,suspend})=>resumeData===undefined?suspend('Number?'):resumeData.value});
 const tool=defineTool({id:'bound',description:'bound',inputSchema:z.number(),outputSchema:z.number(),binding:'remote'});
 export default defineLoom({id:'recovery-binding',version:'1.0.0',description:'binding',entry:defineWorkflow({id:'main',inputSchema:z.number(),outputSchema:z.number()}).then(wait).then(defineStep(tool,{id:'tool'})).commit()});`,
  );
  let calls = 0;
  let resolves = 0;
  const bindings = {
    tools: {
      "*": {
        remote: {
          implementation: "remote",
          revision: "1",
          credentialRef: "env:P5_CREDENTIAL",
          execute: ({
            input,
            credential,
          }: {
            input: unknown;
            credential?: string;
          }) => {
            calls++;
            assert.equal(credential, "rotated");
            return Number(input) + 1;
          },
        },
      },
    },
    resolveCredential: () => {
      resolves++;
      return "initial";
    },
  };
  let host = await serve({ dataDir, bindings });
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: 1 });
  await host.startRun(run.id);
  await settled(host, run.id);
  await host.close();
  assert.equal(calls, 0);
  const count = resolves;
  host = await serve({ dataDir });
  assert.equal(
    (await host.getRun(run.id)).recoveryIssue?.code,
    "BINDING_UNAVAILABLE",
  );
  await host.close();
  assert.equal(resolves, count);
  host = await serve({
    dataDir,
    bindings: {
      ...bindings,
      resolveCredential: () => {
        throw new Error("missing");
      },
    },
  });
  const [request] = await host.listInteractions({ runId: run.id });
  assert.ok(request);
  const receipt = await host.respondInteraction(
    request.id,
    { action: "submit", value: {} },
    { source: { kind: "test", via: "api" } },
  );
  assert.equal(receipt.continuation.status, "needs_attention");
  assert.equal(
    (await host.getInteraction(request.id)).request.status,
    "answered",
  );
  assert.equal((await host.getRun(run.id)).status, "waiting");
  await host.close();
  host = await serve({
    dataDir,
    bindings: { ...bindings, resolveCredential: () => "rotated" },
  });
  t.after(() => host.close());
  await host.resumeRun({ runId: run.id, requestId: request.id });
  assert.equal((await settled(host, run.id)).output, 4);
  assert.equal(calls, 1);
});
test("REC09 a missing native snapshot preserves the request and refuses dispatch instead of failing or replaying", async (t) => {
  const { directory, dataDir } = await fixture(t, simple);
  phase(directory, "start");
  const initial = await readView(directory);
  const db = createClient({
    url: pathToFileURL(join(initial.run.location.dataDir, "mastra.db")).href,
  });
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  const table = String(
    tables.rows.find(
      (row: { name: unknown }) =>
        String(row.name) === "mastra_workflow_snapshot",
    )?.name,
  );
  assert.equal(table, "mastra_workflow_snapshot");
  const original = await db.execute(
    "SELECT * FROM mastra_workflow_snapshot WHERE run_id = ?",
    [initial.run.id],
  );
  await db.execute("DELETE FROM mastra_workflow_snapshot WHERE run_id = ?", [
    initial.run.id,
  ]);
  db.close();
  phase(directory, "inspect");
  assert.equal(
    (await readView(directory)).run.recoveryIssue.code,
    "CHECKPOINT_UNAVAILABLE",
  );
  const host = await serve({ dataDir });
  const receipt = await host.respondInteraction(
    initial.interactions[0].id,
    { action: "submit", value: {} },
    { source: { kind: "test", via: "api" } },
  );
  assert.equal(receipt.continuation.status, "needs_attention");
  assert.equal((await host.getRun(initial.run.id)).status, "waiting");
  await host.close();
  const row = original.rows[0];
  assert.ok(row);
  assert.equal(
    await readFile(join(directory, "effects"), "utf8"),
    "before\nprojection\n",
  );
  const restore = createClient({
    url: pathToFileURL(join(initial.run.location.dataDir, "mastra.db")).href,
  });
  await restore.execute({
    sql: `INSERT INTO mastra_workflow_snapshot (${original.columns.join(",")}) VALUES (${original.columns.map(() => "?").join(",")})`,
    args: original.columns.map((column: string) => row[column]),
  });
  restore.close();
  const restored = await serve({ dataDir });
  t.after(() => restored.close());
  await restored.resumeRun({
    runId: initial.run.id,
    requestId: initial.interactions[0].id,
  });
  assert.equal((await settled(restored, initial.run.id)).output, 5);
});
test("saved cancellation at a quiet wait is completed on restart and closes pending requests", async (t) => {
  const { directory, dataDir } = await fixture(t, simple);
  phase(directory, "start");
  phase(directory, "cancel_saved");
  await clearTrigger(dataDir, "fail_cancel");
  phase(directory, "inspect");
  const view = await readView(directory);
  assert.equal(view.run.status, "cancelled");
  assert.equal(view.interactions[0].status, "closed");
  assert.equal(
    await readFile(join(directory, "effects"), "utf8"),
    "before\nprojection\n",
  );
});
test("the answer boundary parses once; restart and native resume reuse the already normalized value", async (t) => {
  const schema = "z.object({value:withDefault(z.number(),3)})";
  const { directory, dataDir } = await fixture(t, (directory) =>
    simple(directory)
      .replace(
        "const wait=",
        `const answer=${schema};const parse=answer.safeParse.bind(answer);answer.safeParse=(input,options)=>{mark('answer-parse');return parse(input,options);};const wait=`,
      )
      .replace(`resumeSchema:${schema}`, "resumeSchema:answer"),
  );
  phase(directory, "start");
  phase(directory, "answer_saved");
  await clearTrigger(dataDir, "fail_resume");
  phase(directory, "inspect");
  phase(directory, "resume");
  assert.equal((await readView(directory)).run.output, 5);
  assert.equal(
    (await readFile(join(directory, "effects"), "utf8"))
      .split("\n")
      .filter((line) => line === "answer-parse").length,
    1,
  );
});
test("REC09 missing original dependency files do not hide parent and child waits or silently replace packages", async (t) => {
  const { directory, dataDir } = await parentFixture(t);
  phase(directory, "start", "parent-compiled");
  const original = await readView(directory);
  let host = await serve({ dataDir });
  const child = await host.getRun(original.run.waits[0].childRunId);
  await host.close();
  const installed = join(dataDir, "packages", child.loom.artifactDigest);
  const backup = join(directory, "missing-original");
  await rename(installed, backup);
  phase(directory, "inspect");
  const missing = await readView(directory);
  assert.equal(missing.run.status, "waiting");
  assert.ok(missing.run.recoveryIssue);
  host = await serve({ dataDir });
  assert.equal((await host.getRun(child.id)).status, "waiting");
  assert.ok((await host.getRun(child.id)).recoveryIssue);
  await host.close();
  await rename(backup, installed);
  host = await serve({ dataDir });
  t.after(() => host.close());
  const [request] = await host.listInteractions({ runId: child.id });
  assert.ok(request);
  await host.respondInteraction(
    request.id,
    { action: "submit", value: {} },
    { source: { kind: "test", via: "api" } },
  );
  let result = await host.getRun(original.run.id);
  for (let i = 0; i < 200; i++) {
    result = await host.getRun(original.run.id);
    if (result.status === "succeeded" || result.status === "failed") break;
    await delay(10);
  }
  assert.equal(result.status, "succeeded", JSON.stringify(result));
  assert.equal(result.output, 5);
  assert.equal(
    (await host.listRuns({ parentRunId: result.id })).items.length,
    1,
  );
});

test("a failed engine open preserves a wait and releases the host after closing", async (t) => {
  const { dataDir, compiled } = await fixture(t, simple);
  let host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: 2 });
  await host.startRun(run.id);
  const wait = await settled(host, run.id);
  assert.equal(wait.status, "waiting");
  await host.close();
  const database = join(wait.location.dataDir, "mastra.db");
  await rename(database, `${database}.saved`);
  await mkdir(database);
  host = await serve({ dataDir });
  const unavailable = await host.getRun(run.id);
  assert.ok(unavailable.recoveryIssue);
  const events = await host.listRunEvents({ runId: run.id, limit: 100 });
  await host.close();
  host = await serve({ dataDir });
  assert.deepEqual(
    await host.listRunEvents({ runId: run.id, limit: 100 }),
    events,
  );
  await host.close();
  await rm(database, { recursive: true });
  await rename(`${database}.saved`, database);
  host = await serve({ dataDir });
  const restored = await host.getRun(run.id);
  assert.deepEqual(restored.waits, wait.waits);
  assert.equal(restored.recoveryIssue, undefined);
  assert.equal(
    (await host.listRunEvents({ runId: run.id, limit: 100 })).items.filter(
      (e) => e.type === "run.waiting",
    ).length,
    1,
  );
});
