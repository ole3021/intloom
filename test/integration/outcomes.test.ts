import { writeFixturePackage } from "./fixture-package.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
  readdir,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { serve, type Kernel } from "../../packages/kernel/dist/index.js";
import type { ArtifactRef } from "../../packages/loom-sdk/dist/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const req = createRequire(join(root, "packages/kernel/package.json"));
const { createClient } = await import(
  pathToFileURL(req.resolve("@libsql/client")).href
);
const hasCode = (code: string) => (error: unknown) =>
  (error as { code?: string }).code === code;
async function fixture(t: TestContext, source?: (directory: string) => string) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-outcomes-"));
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
  await writeFile(
    join(author, "loom.ts"),
    source
      ? source(directory)
      : await readFile(
          join(root, "test/fixtures/outcomes-outcome.ts.fixture"),
          "utf8",
        ),
  );
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
    const run = await host.getRun(id);
    if (!["created", "running", "stopping"].includes(run.status)) return run;
    await delay(10);
  }
  throw new Error("Run did not settle");
}
async function execute(
  host: Kernel,
  loom: Parameters<Kernel["createRun"]>[0]["loom"],
  input: unknown,
) {
  const run = await host.createRun({ loom, input });
  await host.startRun(run.id);
  return settled(host, run.id);
}

test("immutable artifacts, canonical acceptance, formal delivery and persisted paginated queries", async (t) => {
  const { dataDir, compiled } = await fixture(t);
  let host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const before = await host.createRun({
    loom,
    input: { mode: "pass", size: 4099 },
  });
  const pending = await host.getRunResult(before.id);
  assert.equal(pending.output, undefined);
  assert.equal(pending.outcome?.deliveries, undefined);
  assert.equal(
    (await host.listArtifacts({ runId: before.id })).items.length,
    0,
  );
  await host.startRun(before.id);
  assert.equal((await settled(host, before.id)).status, "succeeded");
  const result = await host.getRunResult(before.id);
  assert.equal(result.quality, "passed");
  assert.equal(result.outcome?.description, "Reviewed report");
  const ref = result.outcome?.deliveries?.report?.[0] as ArtifactRef;
  const first = await host.listArtifacts({ runId: before.id, limit: 1 });
  assert.ok(first.nextCursor);
  const second = await host.listArtifacts({
    runId: before.id,
    limit: 1,
    cursor: first.nextCursor,
  });
  assert.equal(first.items.length, 1);
  assert.equal(second.items.length, 1);
  assert.notEqual(first.items[0]?.id, second.items[0]?.id);
  assert.equal(first.items[0]?.name, second.items[0]?.name);
  const metadata = await host.getArtifact(ref.id);
  assert.equal(metadata.origin.componentId, "produce");
  assert.equal(metadata.size, 4099);
  const bytes = await host.readArtifact({ artifactId: ref.id });
  assert.equal(
    createHash("sha256").update(bytes.data).digest("hex"),
    metadata.digest,
  );
  const range = await host.readArtifact({
    artifactId: ref.id,
    offset: 4096,
    length: 3,
  });
  assert.deepEqual(range, {
    data: bytes.data.slice(4096),
    offset: 4096,
    length: 3,
    totalSize: 4099,
    eof: true,
  });
  assert.equal(
    (await host.readArtifact({ artifactId: ref.id, offset: 4099 })).length,
    0,
  );
  await assert.rejects(
    host.readArtifact({ artifactId: ref.id, offset: 4100 }),
    hasCode("INVALID_ARGUMENT"),
  );
  await assert.rejects(
    host.readArtifact({ artifactId: ref.id, length: 1048577 }),
    hasCode("INVALID_ARGUMENT"),
  );
  await assert.rejects(
    host.getArtifact("../../kernel.db"),
    hasCode("ARTIFACT_NOT_FOUND"),
  );
  await assert.rejects(
    host.listAcceptances({ runId: before.id, cursor: first.nextCursor }),
    hasCode("INVALID_ARGUMENT"),
  );
  assert.ok(result.acceptance);
  const acceptance = await host.getAcceptance(result.acceptance.id);
  assert.equal(
    acceptance.subjectDigest,
    createHash("sha256")
      .update(
        JSON.stringify({
          report: { id: ref.id, kind: "artifact", runId: ref.runId },
          revision: 1,
        }),
      )
      .digest("hex"),
  );
  assert.equal(acceptance.status, "passed");
  assert.equal(acceptance.origin.componentId, "produce");
  const events = (await host.listRunEvents({ runId: before.id, limit: 100 }))
    .items;
  assert.equal(
    events.filter((event) => event.type === "artifact.created").length,
    2,
  );
  assert.equal(
    events.filter((event) => event.type === "acceptance.recorded").length,
    1,
  );
  assert.equal(events.filter((event) => event.type === "log").length, 1);
  await host.close();
  host = await serve({ dataDir });
  assert.deepEqual(await host.getRunResult(before.id), result);
  assert.deepEqual(await host.getAcceptance(result.acceptance.id), acceptance);
  assert.deepEqual(await host.readArtifact({ artifactId: ref.id }), bytes);
});

test("quality rejection, technical error, stale subjects and contract coverage have distinct outcomes", async (t) => {
  const { dataDir, compiled } = await fixture(t);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  for (const [mode, status, code] of [
    ["reject", "succeeded", undefined],
    ["error", "failed", "ACCEPTANCE_EXECUTION_FAILED"],
    ["throw", "failed", "EXECUTION_FAILED"],
    ["changed", "failed", "OUTCOME_CONTRACT_UNSATISFIED"],
    ["wrong_owner", "failed", "OUTCOME_CONTRACT_UNSATISFIED"],
    ["duplicate", "failed", "OUTCOME_CONTRACT_UNSATISFIED"],
    ["missing_check", "failed", "OUTCOME_CONTRACT_UNSATISFIED"],
    ["binary_text", "failed", "ARTIFACT_NOT_TEXT"],
  ] as const) {
    const run = await execute(host, loom, { mode, size: 0 });
    assert.equal(run.status, status, mode);
    assert.equal(run.error?.code, code, mode);
    const result = await host.getRunResult(run.id);
    assert.equal(
      result.quality,
      mode === "reject" ? "rejected" : "not_requested",
      mode,
    );
    if (status === "failed") {
      assert.equal(result.output, undefined, mode);
      assert.equal(result.outcome?.deliveries, undefined, mode);
    }
    assert.equal(
      (await host.listArtifacts({ runId: run.id })).items.length,
      2,
      mode,
    );
    if (mode === "error") {
      const report = (await host.listAcceptances({ runId: run.id })).items[0];
      assert.ok(report);
      assert.equal(report.status, "error");
      assert.deepEqual(report.result.error?.details, {
        nested: [null, { retryable: false }],
      });
    }
  }
});

const slots = () => `
import {defineCode,defineLoom,ArtifactRefSchema} from '@intloom/loom-sdk';
import {z} from 'zod';
export default defineLoom({id:'outcomes-slots',version:'1.0.0',description:'Slots',outcome:{artifacts:{main:{at:'/a~1b/~0list',multiple:true,mediaTypes:['text/plain']},optional:{at:'/optional',required:false}}},entry:defineCode({id:'write',inputSchema:z.string(),outputSchema:z.object({'a/b':z.object({'~list':z.array(ArtifactRefSchema)}),optional:ArtifactRefSchema.optional()}),execute:async({inputData,context})=>{
 const file=await context.artifacts.write({name:'../display.txt',mediaType:inputData==='mime'?'application/json':'text/plain',data:'您好 🌍'});
 if(inputData==='read') { const text=await context.artifacts.readText(file);if(text!=='您好 🌍')throw new Error('unicode'); }
 return {'a/b':{'~list':inputData==='empty'?[]:[file]},...(inputData==='optional'?{optional:{kind:'artifact' as const,id:'missing',runId:context.run.runId}}:{})};
}})});`;
test("escaped JSON Pointers, required multiple slots, optional references and text reads", async (t) => {
  const { dataDir, compiled } = await fixture(t, slots);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  for (const mode of ["read", "empty", "mime", "optional"]) {
    const run = await execute(host, loom, mode);
    assert.equal(run.status, mode === "read" ? "succeeded" : "failed", mode);
    if (mode === "read") {
      const result = await host.getRunResult(run.id);
      assert.equal(result.quality, "not_requested");
      assert.equal(result.outcome?.deliveries?.main?.length, 1);
      assert.equal(result.outcome?.deliveries?.optional, undefined);
    } else assert.equal(run.error?.code, "OUTCOME_CONTRACT_UNSATISFIED");
  }
});

test("file writes, metadata writes and acceptance writes fail without publishing a reference or success", async (t) => {
  for (const failure of ["file", "artifact_record", "acceptance_record"]) {
    const { dataDir, compiled } = await fixture(t);
    const host = await serve({ dataDir });
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const prepared = await host.createRun({
      loom,
      input: { mode: "pass", size: 1 },
    });
    assert.ok(prepared.location);
    const db = createClient({
      url: pathToFileURL(join(prepared.location.dataDir, "kernel.db")).href,
    });
    if (failure === "file")
      await writeFile(
        join(prepared.location.dataDir, "artifacts"),
        "not a directory",
      );
    else
      await db.execute(
        `CREATE TRIGGER fail_save BEFORE INSERT ON ${failure === "artifact_record" ? "artifacts" : "acceptances"} BEGIN SELECT RAISE(ABORT, 'injected'); END`,
      );
    await host.startRun(prepared.id);
    if (failure === "file") {
      const run = await settled(host, prepared.id);
      assert.equal(run.status, "failed");
      assert.equal(run.error?.code, "STORAGE_FAILED");
    } else {
      for (let i = 0; i < 200 && !(await host.getStorageIssues()).length; i++)
        await delay(10);
      await assert.rejects(host.getRun(prepared.id), {
        code: "STORAGE_UNAVAILABLE",
      });
      assert.equal((await host.getStorageIssues()).length, 1);
    }
    await host.close();
    const {
      rows: [savedRow],
    } = await db.execute({
      sql: "SELECT record FROM runs WHERE id = ?",
      args: [prepared.id],
    });
    assert.ok(savedRow);
    const saved = JSON.parse(String(savedRow.record));
    assert.notEqual(saved.view.status, "succeeded");
    assert.equal(
      Number(
        (await db.execute("SELECT COUNT(*) AS n FROM artifacts")).rows[0]?.n,
      ),
      failure === "acceptance_record" ? 2 : 0,
    );
    assert.equal(
      Number(
        (await db.execute("SELECT COUNT(*) AS n FROM acceptances")).rows[0]?.n,
      ),
      0,
    );
    if (failure === "artifact_record")
      assert.equal(
        (await readdir(join(prepared.location.dataDir, "artifacts"))).length,
        1,
      );
    db.close();
    await host.close();
  }
});

const waiting = (directory: string) => `
import {appendFileSync} from 'node:fs';
import {defineLoom,defineWorkflow,defineStep,ArtifactRefSchema,AcceptanceRefSchema} from '@intloom/loom-sdk';import {z} from 'zod';
const result=z.object({deliverable:z.object({file:ArtifactRefSchema}),acceptance:AcceptanceRefSchema});
const generate=defineStep({id:'generate',inputSchema:z.null(),outputSchema:result,execute:async({context})=>{
 appendFileSync(${JSON.stringify(join(directory, "effects"))},'evaluate\\n');
 const file=await context.artifacts.write({name:'final.txt',mediaType:'text/plain',data:'Final bytes'});
 const deliverable={file};const acceptance=await context.acceptance.record({subject:deliverable,result:{checks:[{criterionId:'valid',status:'passed',evidence:[file]}]}});
 return {deliverable,acceptance};
}});
const wait=defineStep({id:'wait',inputSchema:result,outputSchema:result,suspendSchema:z.null(),resumeSchema:z.boolean(),execute:async({inputData,resumeData,suspend})=>{if(resumeData===undefined)return suspend(null);return inputData;}});
export default defineLoom({id:'outcomes-wait',version:'1.0.0',description:'Retained material',outcome:{artifacts:{file:{at:'/deliverable/file'}},acceptance:{at:'/acceptance',subjectAt:'/deliverable',criteria:[{id:'valid',description:'Valid'}]}},entry:defineWorkflow({id:'flow',inputSchema:z.null(),outputSchema:result}).then(generate).then(wait).commit()});`;

test("cancellation retains artifacts and reports without a formal delivery", async (t) => {
  const { dataDir, compiled } = await fixture(t, waiting);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await execute(host, loom, null);
  assert.equal(run.status, "waiting");
  const files = await host.listArtifacts({ runId: run.id });
  const retained = files.items[0];
  assert.ok(retained);
  await host.cancelRun(run.id);
  const result = await host.getRunResult(run.id);
  assert.equal(result.runStatus, "cancelled");
  assert.equal(result.output, undefined);
  assert.equal(result.outcome?.deliveries, undefined);
  assert.equal(
    new TextDecoder().decode(
      (await host.readArtifact({ artifactId: retained.id })).data,
    ),
    "Final bytes",
  );
  assert.equal(
    (await host.listAcceptances({ runId: run.id })).items[0]?.status,
    "passed",
  );
});

test("missing or changed saved bytes prevent final delivery and remain diagnosable", async (t) => {
  for (const mode of ["missing", "changed"]) {
    const { dataDir, compiled } = await fixture(t, waiting);
    const host = await serve({ dataDir });
    const loom = await host.installLoom({ source: compiled.artifactDir });
    const run = await execute(host, loom, null);
    const file = (await host.listArtifacts({ runId: run.id })).items[0];
    assert.ok(file);
    const wait = run.waits[0];
    assert.ok(wait);
    assert.ok(run.location);
    if (mode === "missing")
      await rm(join(run.location.dataDir, "artifacts", file.id));
    else
      await writeFile(
        join(run.location.dataDir, "artifacts", file.id),
        "Alter bytes",
      );
    await host.resumeRun({
      runId: run.id,
      waitId: wait.waitId,
      resumeData: true,
    });
    const ended = await settled(host, run.id);
    assert.equal(ended.status, "failed");
    assert.equal(ended.error?.code, "OUTCOME_CONTRACT_UNSATISFIED");
    assert.equal((await host.getArtifact(file.id)).id, file.id);
    await assert.rejects(
      host.readArtifact({ artifactId: file.id }),
      hasCode("ARTIFACT_UNAVAILABLE"),
    );
    await host.close();
  }
});

function phase(directory: string, mode: string) {
  const result = spawnSync(
    process.execPath,
    [
      join(root, "test/integration/fixtures/outcomes-process.mjs"),
      join(root, "packages/kernel/package.json"),
      directory,
      mode,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(
    result.status,
    0,
    `${mode}: ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
}
test("fresh processes repair completed delivery atomically without evaluation or author modules", async (t) => {
  for (const mode of ["complete", "missing_file", "missing_report"]) {
    const { directory, dataDir } = await fixture(t, waiting);
    phase(directory, "start");
    phase(directory, "complete_unpublished");
    const saved = JSON.parse(
      await readFile(join(directory, "run.json"), "utf8"),
    );
    const db = createClient({
      url: pathToFileURL(join(saved.location.dataDir, "kernel.db")).href,
    });
    const row = (await db.execute("SELECT record FROM runs")).rows[0];
    assert.ok(row);
    const persisted = JSON.parse(String(row.record));
    assert.equal(persisted.view.status, "running");
    assert.equal(persisted.result, undefined);
    assert.equal(persisted.view.output, undefined);
    if (mode === "missing_report") await db.execute("DELETE FROM acceptances");
    if (mode === "missing_file") {
      const file = (await db.execute("SELECT id FROM artifacts")).rows[0];
      assert.ok(file);
      await rm(join(saved.location.dataDir, "artifacts", String(file.id)));
    }
    await db.execute("DROP TRIGGER fail_complete");
    db.close();
    await rm(join(dataDir, "packages"), { recursive: true, force: true });
    phase(directory, "inspect");
    const result = JSON.parse(
      await readFile(join(directory, "result.json"), "utf8"),
    );
    assert.equal(
      result.runStatus,
      mode === "complete" ? "succeeded" : "failed",
      mode,
    );
    assert.equal(
      result.quality,
      mode === "complete" ? "passed" : "not_requested",
    );
    if (mode !== "complete")
      assert.equal(result.error.code, "OUTCOME_CONTRACT_UNSATISFIED");
    assert.equal(
      await readFile(join(directory, "effects"), "utf8"),
      "evaluate\n",
    );
    phase(directory, "inspect");
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, "result.json"), "utf8")),
      result,
    );
  }
});

test("root delivery, explicit reuse and minimal output need no Acceptance", async (t) => {
  const { dataDir, compiled } = await fixture(
    t,
    () => `
import {defineCode,defineLoom,ArtifactRefSchema} from '@intloom/loom-sdk';import {z} from 'zod';
export default defineLoom({id:'outcomes-root',version:'1.0.0',description:'Root',outcome:{artifacts:{file:{at:''}}},entry:defineCode({id:'file',inputSchema:ArtifactRefSchema.nullable(),outputSchema:ArtifactRefSchema,execute:async({inputData,context})=>inputData??context.artifacts.write({name:'root.txt',mediaType:'text/plain',data:'root'})})});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const first = await execute(host, loom, null);
  const second = await execute(host, loom, first.output);
  assert.equal(second.status, "succeeded");
  assert.deepEqual(
    (await host.getRunResult(second.id)).outcome?.deliveries?.file,
    [first.output],
  );
  assert.equal(
    (await host.listArtifacts({ runId: second.id })).items.length,
    0,
  );
  assert.equal(
    (await host.listAcceptances({ runId: second.id })).items.length,
    0,
  );
  assert.equal((second.output as ArtifactRef).runId, first.id);
  const fake = await execute(host, loom, {
    kind: "artifact",
    id: "unregistered",
    runId: first.id,
  });
  assert.equal(fake.error?.code, "OUTCOME_CONTRACT_UNSATISFIED");
  const author = join(dataDir, "plain-author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(
    join(author, "loom.ts"),
    `import {defineCode,defineLoom} from '@intloom/loom-sdk';import {z} from 'zod';export default defineLoom({id:'outcomes-plain',version:'1.0.0',description:'Plain',entry:defineCode({id:'plain',inputSchema:z.null(),outputSchema:z.null(),execute:()=>null})});`,
  );
  await writeFixturePackage(join(author, "loom.ts"));
  const plain = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(dataDir, "plain"),
    target: "node22",
  });
  assert.ok(plain.ok);
  const simple = await execute(
    host,
    await host.installLoom({ source: plain.artifactDir }),
    null,
  );
  assert.deepEqual(await host.getRunResult(simple.id), {
    runId: simple.id,
    runStatus: "succeeded",
    quality: "not_requested",
    output: null,
  });
  assert.equal(
    (await host.listArtifacts({ runId: simple.id })).items.length,
    0,
  );
  assert.equal(
    (await host.listAcceptances({ runId: simple.id })).items.length,
    0,
  );
});

test("iteration preserves rejected reports, canonical key order and single business validation", async (t) => {
  const { dataDir, compiled, directory } = await fixture(
    t,
    (directory) => `
import {appendFileSync} from 'node:fs';import {defineLoom,defineCode,AcceptanceReportSchema,AcceptanceRefSchema} from '@intloom/loom-sdk';import {z} from 'zod';
export default defineLoom({id:'outcomes-iteration',version:'1.0.0',description:'Iteration',outcome:{acceptance:{at:'/acceptance',subjectAt:'/subject',criteria:[{id:'valid',description:'Valid'}]}},entry:defineCode({id:'iterate',inputSchema:z.null(),outputSchema:z.object({subject:z.object({a:z.number(),b:z.string()}),acceptance:AcceptanceRefSchema}),execute:async({context})=>{
 const original=AcceptanceReportSchema.safeParse.bind(AcceptanceReportSchema);
 AcceptanceReportSchema.safeParse=((...args:Parameters<typeof original>)=>{appendFileSync(${JSON.stringify(join(directory, "parsed"))},'parse\\n');return original(...args);}) as typeof AcceptanceReportSchema.safeParse;
 const parsed=AcceptanceReportSchema.safeParse({checks:[{criterionId:'valid',status:'passed'}]});if(!parsed.success)throw new Error('invalid');
 await context.acceptance.record({subject:{b:'v',a:0},result:{checks:[{criterionId:'valid',status:'rejected'}]}});
 const acceptance=await context.acceptance.record({subject:{b:'v',a:1},result:parsed.data});
 return {subject:{a:1,b:'v'},acceptance};
}})});`,
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const run = await execute(
    host,
    await host.installLoom({ source: compiled.artifactDir }),
    null,
  );
  assert.equal(run.status, "succeeded");
  const reports = (await host.listAcceptances({ runId: run.id })).items;
  assert.deepEqual(reports.map((r) => r.status).sort(), ["passed", "rejected"]);
  assert.notEqual(reports[0]?.subjectDigest, reports[1]?.subjectDigest);
  assert.equal(
    (await host.getRunResult(run.id)).acceptance?.id,
    reports.find((r) => r.status === "passed")?.id,
  );
  assert.equal(await readFile(join(directory, "parsed"), "utf8"), "parse\n");
});

test("parent delivers child-owned artifacts, handles rejected quality and cannot adopt a child report", async (t) => {
  const { directory, dataDir, compiled } = await fixture(t);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  await host.installLoom({ source: compiled.artifactDir });
  const parent = join(directory, "parent");
  await mkdir(parent);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(parent, "node_modules"),
  );
  const catalog = await host.getLoomCatalog();
  for (const own of [true, false]) {
    await writeFile(
      join(parent, "loom.ts"),
      `
import {defineLoom,defineWorkflow,defineStep,ArtifactRefSchema,AcceptanceRefSchema} from '@intloom/loom-sdk';import {z} from 'zod';import {child} from './.intloom/dependencies.ts';
const output=z.object({deliverable:z.object({report:ArtifactRefSchema,revision:z.number()}),acceptance:AcceptanceRefSchema});
const finish=defineStep({id:'finish',inputSchema:output,outputSchema:output,execute:async({inputData,context})=>({...inputData,acceptance:${own ? "await context.acceptance.record({subject:inputData.deliverable,result:{checks:[{criterionId:'complete',status:'passed'}]}})" : "inputData.acceptance"}})});
export default defineLoom({id:'outcomes-parent-${own}',dependencies:{child:{id:'outcomes-outcome',version:'1.0.0'}},version:'1.0.0',description:'Parent',outcome:{artifacts:{report:{at:'/deliverable/report'}},acceptance:{at:'/acceptance',subjectAt:'/deliverable',criteria:[{id:'complete',description:'Complete candidate'}]}},entry:defineWorkflow({id:'parent',inputSchema:z.object({mode:z.string(),size:z.number()}),outputSchema:output}).then(defineStep(child,{id:'call'})).then(finish).commit()});`,
    );
    await writeFixturePackage(join(parent, "loom.ts"));
    const built = await compileLoom({
      entryFile: join(parent, "loom.ts"),
      outDir: join(directory, `parent-${own}`),
      target: "node22",
      catalog,
    });
    assert.ok(built.ok, JSON.stringify(built));
    const run = await execute(
      host,
      await host.installLoom({ source: built.artifactDir }),
      { mode: "reject", size: 4 },
    );
    assert.equal(run.status, own ? "succeeded" : "failed");
    const childRun = (await host.listRuns({ parentRunId: run.id })).items[0];
    assert.ok(childRun);
    assert.equal((await host.getRunResult(childRun.id)).quality, "rejected");
    if (own) {
      const result = await host.getRunResult(run.id);
      assert.equal(result.quality, "passed");
      assert.equal(result.outcome?.deliveries?.report?.[0]?.runId, childRun.id);
      assert.equal(
        (await host.listArtifacts({ runId: run.id })).items.length,
        0,
      );
    } else assert.equal(run.error?.code, "OUTCOME_CONTRACT_UNSATISFIED");
  }
});

test("full Artifact export only publishes bytes that match the saved digest", async (t) => {
  const { directory, dataDir, compiled } = await fixture(t);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await execute(host, loom, {
    mode: "pass",
    size: 2 * 1024 * 1024 + 1,
  });
  const record = (await host.listArtifacts({ runId: run.id })).items.find(
    (item) => item.size === 2 * 1024 * 1024 + 1,
  );
  assert.ok(record);
  const path = join(directory, "exported");
  const options = { artifactId: record.id, path };
  const file = join(run.location.dataDir, "artifacts", record.id);
  await host.exportArtifact(options);
  assert.equal(
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    record.digest,
  );
  await assert.rejects(host.exportArtifact(options), { code: "FILE_EXISTS" });
  await writeFile(file, "corrupt");
  await assert.rejects(host.exportArtifact({ ...options, overwrite: true }), {
    code: "ARTIFACT_UNAVAILABLE",
  });
  assert.equal(
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    record.digest,
  );
  assert.ok(
    !(await readdir(directory)).some((entry) =>
      entry.startsWith(".intloom-export-"),
    ),
  );
});
