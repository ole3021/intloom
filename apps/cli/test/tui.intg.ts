import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createCliCore } from "@intloom/cli";
import {
  projectFixture,
  configureProject,
  refreshFixtureInstallation,
} from "./project-fixture.ts";
import type { MirrorManifest } from "@intloom/kernel";
import { artifactLoom } from "./artifact-fixture.ts";

const execute = promisify(execFile);
const require = createRequire(new URL("../package.json", import.meta.url));
const solid = pathToFileURL(require.resolve("@opentui/solid")).href;
const app = new URL("../dist/tui/app.js", import.meta.url).href;
const api = new URL("../dist/core/index.js", import.meta.url).href;

async function native(
  projectPath: string,
  body: string,
  args: string[] = [],
  setup = "",
) {
  const script = `
import assert from 'node:assert/strict';
import {testRender} from ${JSON.stringify(solid)};
import {App} from ${JSON.stringify(app)};
import {createCliCore} from ${JSON.stringify(api)};
const core=createCliCore(), projectPath=process.argv[1];
${setup}
const view=await testRender(()=>App({projectPath,core}),{width:100,height:32,kittyKeyboard:true});
async function frame(matcher){for(let i=0;i<250;i++){await new Promise(r=>setTimeout(r,20));await view.flush();const value=view.captureCharFrame();if(matcher.test(value))return value;}throw new Error('Expected '+matcher+': '+view.captureCharFrame());}
async function key(name,modifiers={}){view.mockInput.pressKey(({escape:'ESCAPE',tab:'TAB',backspace:'BACKSPACE',down:'ARROW_DOWN',up:'ARROW_UP',left:'ARROW_LEFT',right:'ARROW_RIGHT',pageup:'PAGE_UP',pagedown:'PAGE_DOWN',end:'END'})[name]??name,modifiers);await view.flush();}
async function enter(modifiers={}){view.mockInput.pressEnter(modifiers);await view.flush();}
async function paste(text){await view.mockInput.pasteBracketedText(text);await view.flush();}
async function command(name){await key('/');await frame(/Commands · MVP/);await paste(name.slice(1));await enter();}
async function assetAction(index){await key('left');for(let i=0;i<index;i++)await key('down');await enter();}
try {${body}} finally {await view.dispose();}
process.stdout.write(JSON.stringify({closed:true}));
`;
  try {
    const result = await execute(
      process.execPath,
      [
        "--experimental-ffi",
        "--input-type=module",
        "-e",
        script,
        projectPath,
        ...args,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(JSON.parse(result.stdout).closed, true);
  } catch (error) {
    if (error && typeof error === "object" && "stderr" in error)
      throw new Error(String(error.stderr));
    throw error;
  }
}

test("native workbench auto-starts, submits multiline intent once, preserves answers, reads resources and cancels", {
  timeout: 40000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);
 await key('p',{ctrl:true});await frame(/Choose Loom/);await enter();await frame(/Loom inputs/);
 let runs=await core.listRuns({projectPath});assert.ok(runs.ok);assert.equal(runs.data.length,0);
 const firstLine='第一行中文 '+ '自动折行 '.repeat(18);
 await paste(firstLine);await enter({shift:true});await paste('second line --literal');await key('j',{ctrl:true});await paste('Ctrl+J fallback');
 await enter();view.mockInput.pressEnter();await frame(/Where should it be deployed/);
 runs=await core.listRuns({projectPath});assert.ok(runs.ok);assert.equal(runs.data.length,1);
 // A rapid second Enter cannot create another Run. The first answer may already advance.
 let visible=view.captureCharFrame();if(visible.includes('Where should'))await enter();
 await frame(/Any additional notes/);await enter();await paste('保留回答草稿');
 await key('tab');await frame(/› Logs/);await key('tab');await frame(/Artifacts/);await assetAction(0);await frame(/once-RUN/);
 await enter();await frame(/"intent"/);await key('escape');await frame(/Records/);
 await key('tab');await frame(/保留回答草稿/);
 await enter();await frame(/Submit all answers/);await enter();await frame(/Confirm saving/);
 await enter();await frame(/Confirm selected/);await enter();await frame(/· completed/);
 const records=await core.listRecords({projectPath});assert.ok(records.ok);
 const saved=records.data.data.find(r=>r.id===runs.data[0].runId);assert.ok(saved);
 assert.equal(saved.data.intent,firstLine+'\\nsecond line --literal\\nCtrl+J fallback');assert.equal(saved.data.answers[1].answer,'保留回答草稿');
 await command('/run');await frame(/Loom inputs/);await paste('Cancel this Run');await enter();await frame(/Where should it be deployed/);
 await command('/stop');await frame(/Keep executing/);await key('down');await enter();await frame(/cancelled/);
 await command('/run');await frame(/Loom inputs/);await paste('Keep waiting after TUI closes');await enter();await frame(/Where should it be deployed/);
 view.resize(60,24);await view.flush();const narrow=view.captureCharFrame();assert.match(narrow,/IntLoom/);assert.match(narrow,/Waiting for your answer/);assert.doesNotMatch(narrow,/Run status/);
 `,
  );
  const core = createCliCore();
  const status = await core.getServiceStatus({ projectPath });
  assert.ok(status.ok && status.data.status === "running");
  const runs = await core.listRuns({ projectPath });
  assert.ok(runs.ok);
  assert.equal(runs.data.length, 3);
  assert.equal(
    runs.data.filter((run) => run.stopReason === "user_cancel").length,
    1,
  );
  assert.equal(
    runs.data.filter((run) => run.status === "waiting" && run.pendingAction)
      .length,
    1,
  );
});

test("native resources show historical revision limits, current content and server filters without writes", {
  timeout: 40000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await writeFile(
    join(projectPath, ".intloom/looms/node_modules/fixture-loom/loom.js"),
    artifactLoom,
  );
  await refreshFixtureInstallation(projectPath);
  const core = createCliCore(),
    started = await core.startService({ projectPath });
  assert.ok(started.ok, JSON.stringify(started));
  const runIds: string[] = [];
  for (const intent of ["Original artifact", "Updated artifact"]) {
    const result = await core.run({
      projectPath,
      serviceInstanceId: started.data.service.instanceId,
      operationId: randomUUID(),
      loomName: "fixture",
      input: { prompt: intent },
    });
    assert.ok(result.ok && result.data.run);
    runIds.push(result.data.run.runId);
    const done = await core.waitRun({
      projectPath,
      runId: result.data.run.runId,
      until: "terminal",
    });
    assert.ok(done.ok && done.data.run.status === "completed");
  }
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);await key('o',{ctrl:true});await frame(/Switch Run/);await paste(process.argv[2]);await enter();await frame(/· completed/);
 await key('tab');await key('tab');await frame(/ART-todo/);await enter();await frame(/historical_revision_unavailable/);
 await key('escape');await assetAction(1);await frame(/All project resources/);await enter();await frame(/Updated artifact/);
 await key('escape');await assetAction(2);await paste('fixture');await key('down');await paste('missing-stage');await enter();await frame(/No resources/);
 await key('tab');await key('tab');await key('tab');await frame(/No resources/);assert.match(view.captureCharFrame(),/missing-stage/);
 await assetAction(2);await key('down');for(let i=0;i<'missing-stage'.length;i++)await key('backspace');await paste('first');await enter();await frame(/ART-todo/);
 await assetAction(0);await frame(/REC-RUN/);await enter();await frame(/"intent"/);
 await key('escape');await key('escape');await frame(/Run logs/);
 `,
    [runIds[0] as string],
  );
  const artifacts = await core.listArtifacts({ projectPath }),
    records = await core.listRecords({ projectPath });
  assert.ok(artifacts.ok && records.ok);
  assert.equal(artifacts.data.data[0]?.revision, 2);
  assert.equal(records.data.data.length, 2);
});

test("native invalid-project startup only directs CMD initialization", {
  timeout: 10000,
}, async (t) => {
  const projectPath = await mkdtemp(join(tmpdir(), "intloom-tui-invalid-"));
  t.after(() => rm(projectPath, { recursive: true, force: true }));
  await native(
    projectPath,
    `await frame(/not an IntLoom project/);assert.match(view.captureCharFrame(),/intloom init/);`,
  );
  assert.deepEqual(await readdir(projectPath), []);
});

test("native slash menu lists only MVP commands, filters immediately and preserves input across three windows", {
  timeout: 25000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);await key('/');const menu=await frame(/Commands · MVP/);
 for(const name of ['/run','/loom','/runs','/resume','/stop','/quit'])assert.ok(menu.includes(name),name);
 for(const name of ['/help','/resources','/cancel','/check','/reconnect'])assert.equal(menu.includes(name),false,name);
 await key('tab');await frame(/Commands · MVP/);
 await paste('st');await frame(/Select an unfinished Run/);assert.equal(view.captureCharFrame().includes('/loom'),false);
 await enter();await frame(/Commands · MVP/);await key('escape');await frame(/Loom inputs/);
 for(const keyName of ['k','n','w','l','e']){await key(keyName,{ctrl:true});assert.doesNotMatch(view.captureCharFrame(),/Commands · MVP|Choose Loom|Switch Run/);}
 const intent='A draft with src/path and literal / text';await paste(intent);
 assert.doesNotMatch(view.captureCharFrame(),/Commands · MVP/);
 await key('p',{ctrl:true});await frame(/Choose Loom/);await key('escape');await frame(new RegExp('src.path'));
 await key('tab');await frame(/No Run selected/);await key('/');await frame(/Commands · MVP/);await key('escape');
 await key('tab');await frame(/Assets/);await key('/');await frame(/Commands · MVP/);await key('escape');
 await key('tab');await frame(new RegExp('src.path'));await enter();await frame(/Where should it be deployed/);
 const runs=await core.listRuns({projectPath});assert.ok(runs.ok);assert.equal(runs.data.length,1);
 const records=await core.listRecords({projectPath});assert.ok(records.ok);assert.equal(records.data.data[0].data.intent,intent);
 await key('tab');await frame(/› Logs/);await key('o',{ctrl:true});await frame(/Switch Run/);await enter();await frame(/› Logs/);
 await key('pageup');await key('end');await command('/quit');
 `,
  );
  const status = await createCliCore().getServiceStatus({ projectPath });
  assert.ok(status.ok && status.data.status === "running");
  const runs = await createCliCore().listRuns({ projectPath });
  assert.ok(
    runs.ok && runs.data.length === 1 && runs.data[0]?.status === "waiting",
  );
});

test("native resume dialog continues an actual restored Step scope then an explicit Loom scope", {
  timeout: 50000,
}, async (t) => {
  const source = await projectFixture(t),
    target = await projectFixture(t);
  for (const root of [source, target]) {
    await configureProject(root, { mirror: { enabled: true } });
    await writeFile(
      join(root, ".intloom/looms/node_modules/fixture-loom/loom.js"),
      artifactLoom,
    );
    await refreshFixtureInstallation(root);
  }
  const core = createCliCore(),
    started = await core.startService({ projectPath: source });
  assert.ok(started.ok);
  const created = await core.run({
    projectPath: source,
    serviceInstanceId: started.data.service.instanceId,
    operationId: randomUUID(),
    loomName: "fixture",
    input: { prompt: "Resumed artifact" },
  });
  assert.ok(created.ok && created.data.run);
  const done = await core.waitRun({
    projectPath: source,
    runId: created.data.run.runId,
    until: "terminal",
  });
  assert.ok(done.ok && done.data.run.status === "completed");
  assert.ok((await core.stopService({ projectPath: source })).ok);
  const images = await core.listMirrors({ projectPath: source });
  assert.ok(images.ok);
  const before = (images.data as MirrorManifest[]).find(
    (image) => image.boundary.kind === "step_before",
  );
  assert.ok(before);
  const restored = await core.restoreMirror({
    projectPath: source,
    mirrorId: before.mirrorId,
    targetProject: target,
    scope: "step",
  });
  assert.ok(restored.ok, JSON.stringify(restored));
  await native(
    target,
    `
 await frame(/restored/);await command('/resume');await frame(/Continue step scope/);await enter();await frame(/scope_completed/);
 await command('/resume');await frame(/Continue Loom/);await key('down');await key('down');await enter();await frame(/· completed/);
 `,
  );
  const resumed = await core.getRun({
    projectPath: target,
    runId: created.data.run.runId,
  });
  assert.ok(resumed.ok && resumed.data.status === "completed");
});

test("native unknown admission retains its operation and checks the receipt without resubmitting", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);await paste('Unknown receipt fixture');await enter();await frame(/REQUEST_OUTCOME_UNKNOWN/);
 await frame(/Inspect original operation/);await enter();await frame(/Where should it be deployed/);
 const runs=await core.listRuns({projectPath});assert.ok(runs.ok);assert.equal(runs.data.length,1);assert.equal(submissions,1);
 `,
    [],
    `
 let submissions=0;
 const submit=core.run;
 core.run=async(input)=>{submissions++;const applied=await submit(input);assert.ok(applied.ok);return {ok:false,error:{code:'REQUEST_OUTCOME_UNKNOWN',message:'Fixture lost the response after admission',retryable:false},outcome:'unknown',meta:{requestId:'fixture',operationId:input.operationId,serviceInstanceId:input.serviceInstanceId}};};
 `,
  );
});

test("native indeterminate receipts retain the operation until inspection resolves it", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);await paste('Indeterminate receipt fixture');await enter();await frame(/Outcome remains unknown/);
 await frame(/Inspect original operation/);await enter();await frame(/Where should it be deployed/);
 const runs=await core.listRuns({projectPath});assert.ok(runs.ok);assert.equal(runs.data.length,1);assert.equal(submissions,1);
 `,
    [],
    `
 let submissions=0;
 const submit=core.run;
 core.run=async(input)=>{submissions++;const applied=await submit(input);assert.ok(applied.ok);return {ok:true,data:{receipt:{status:'indeterminate',kind:'run',operationId:input.operationId,serviceInstanceId:input.serviceInstanceId,error:{code:'RUN_CHECKPOINT_FAILED',message:'Fixture cannot confirm effects',retryable:false}}},meta:applied.meta};};
 `,
  );
});

test("native startup activity animates in place and becomes idle after connection", {
  timeout: 15000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  await native(
    projectPath,
    `
 await frame(/loading/);const first=view.captureCharFrame().trimStart()[0];
 await new Promise(r=>setTimeout(r,160));await view.flush();const second=view.captureCharFrame().trimStart()[0];
 assert.notEqual(first,second);await frame(/I N T L O O M/);assert.match(view.captureCharFrame().trimStart(),/^IntLoom/);
 `,
    [],
    `
 const status=core.getServiceStatus;let first=true;
 core.getServiceStatus=async(input)=>{if(first){first=false;await new Promise(r=>setTimeout(r,600));}return status(input);};
 `,
  );
});

test("native resource pagination retains loaded entries and follows the Service cursor", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const loom = artifactLoom.replace(
    'return { outcome: "complete" };',
    `
  await access.storage.commit(Array.from({length:52},(_,index)=>({type:"append_record",id:"REC-page-"+index,payload:{loomName:"fixture",stageName:"first",data:{page:index}}})));
  return { outcome: "complete" };`,
  );
  await writeFile(
    join(projectPath, ".intloom/looms/node_modules/fixture-loom/loom.js"),
    loom,
  );
  await refreshFixtureInstallation(projectPath);
  const core = createCliCore(),
    started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const created = await core.run({
    projectPath,
    serviceInstanceId: started.data.service.instanceId,
    operationId: randomUUID(),
    loomName: "fixture",
    input: { prompt: "Pagination fixture" },
  });
  assert.ok(created.ok && created.data.run);
  const done = await core.waitRun({
    projectPath,
    runId: created.data.run.runId,
    until: "terminal",
  });
  assert.ok(done.ok && done.data.run.status === "completed");
  await native(
    projectPath,
    `
 await frame(/I N T L O O M/);await key('tab');await key('tab');await frame(/ART-todo/);await assetAction(0);await frame(new RegExp('50/50 loaded'));
 for(let i=0;i<50;i++)await key('down');await frame(/Load next page/);await enter();await frame(new RegExp('53/53 loaded'));
 `,
  );
  const records = await core.listRecords({
    projectPath,
    query: { limit: 200 },
  });
  assert.ok(records.ok);
  assert.equal(records.data.data.length, 53);
});

test("native multiple unfinished Runs use a picker that keeps selection during live snapshots", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t),
    core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const ids: string[] = [];
  for (const intent of ["Earlier Run", "Later Run"]) {
    const created = await core.run({
      projectPath,
      serviceInstanceId: started.data.service.instanceId,
      operationId: randomUUID(),
      loomName: "fixture",
      input: { prompt: intent },
    });
    assert.ok(created.ok && created.data.run);
    ids.push(created.data.run.runId);
    assert.ok(
      (await core.waitRun({ projectPath, runId: created.data.run.runId })).ok,
    );
  }
  await native(
    projectPath,
    `
 await frame(/Switch Run/);await key('down');await new Promise(r=>setTimeout(r,1500));await view.flush();await enter();
 const selected=await frame(/Waiting for your answer/);assert.ok(selected.includes(process.argv[2]));
 `,
    [ids[0] as string],
  );
  const runs = await core.listRuns({ projectPath });
  assert.ok(runs.ok && runs.data.every((run) => run.status === "waiting"));
});
