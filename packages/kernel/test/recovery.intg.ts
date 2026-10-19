import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { test } from "node:test";
import { compiledLoom } from "./initialization-fixture.ts";
import { projectFixture } from "./project-fixture.ts";
import { codeId } from "./loom-fixture.ts";

const execute = promisify(execFile);
const kernelUrl = import.meta.resolve("@intloom/kernel/host");
const operationsUrl = import.meta.resolve("@intloom/kernel/operations");
const storageUrl = import.meta.resolve("@intloom/kernel/storage/file");

test("independent Node processes restore an exact waiting action and commit once through built package entries", async (t) => {
  const project = await projectFixture(t);
  const effects = join(project.root, "effects.txt");
  await project.add(
    "recoverable-run",
    compiledLoom("fixture", codeId).replace(
      /export const codes = .*;/u,
      `import { appendFileSync } from 'node:fs';
const code = async (access) => {
  appendFileSync(${JSON.stringify(effects)}, 'before\\n');
  await access.state.update({value:'saved draft'});
  const answer = await access.interaction.confirm('Save this draft?');
  return finish(answer, access);
};
async function finish(answer, access) {
  if (!answer.isConfirmed || access.state.value.value !== 'saved draft') throw new Error('Invalid recovery');
  await access.storage.commit([{type:'append_record',id:'saved-once',payload:{loomName:'fixture',stageName:'first',data:access.state.value}}]);
  appendFileSync(${JSON.stringify(effects)}, 'after\\n');
  return {outcome:'complete'};
}
code.recover = (saved, access) => finish(saved.answer, access);
export const codes = { [${JSON.stringify(codeId)}]: code };`,
    ),
  );
  const prefix = `
import {randomUUID} from 'node:crypto';
import {initializeProject, createExecution, createOperationsPorts} from ${JSON.stringify(kernelUrl)};
import {createOperations, createOperationReceipts, waitForRun} from ${JSON.stringify(operationsUrl)};
import {openFileStorage} from ${JSON.stringify(storageUrl)};
const root=${JSON.stringify(project.root)};
const storage=await openFileStorage({directory:root+'/store'});
const execution=await initializeProject(root,{storage:storage.access,executor:createExecution(),runtimeDirectory:root+'/.intloom/runtime'});
const serviceInstanceId=randomUUID();
const ports=createOperationsPorts(execution,{
  receipts:createOperationReceipts(serviceInstanceId),
  storage:storage.access,
  assertOpen(){},
  presentRun:run=>run,
  async status(){throw new Error('Unexpected status query');},
});
const operations=createOperations(ports,'cli');
async function mutate(kind,parameters,runId){
  const {receipt}=await operations.admit(kind,{...parameters,serviceInstanceId,operationId:randomUUID()},runId);
  if(receipt.status!=='accepted')throw new Error('Admission failed: '+JSON.stringify(receipt));
  return waitForRun(ports.runtime,receipt.runId);
}
`;
  async function run(body: string) {
    const result = await execute(
      process.execPath,
      ["--input-type=module", "--eval", prefix + body],
      { timeout: 30_000 },
    );
    return JSON.parse(result.stdout);
  }
  const waiting = await run(`
const waiting=await mutate('run',{loomName:'fixture',input:{prompt:'original request'}});
console.log(JSON.stringify(waiting));
await storage.dispose();
process.exit(0); // Exit without Runtime shutdown or cancellation.
`);
  assert.equal(waiting.status, "waiting");
  const completed = await run(`
const [waiting]=await operations.listRuns();
if(waiting.pendingAction.id!==${JSON.stringify(waiting.pendingAction.id)})throw new Error('Action changed');
const done=await mutate('answer',{actionId:waiting.pendingAction.id,answer:{isConfirmed:true}},waiting.runId);
console.log(JSON.stringify({done,record:await storage.access.getRecordById('saved-once')}));
await execution.runtime.suspend();await storage.dispose();
`);
  assert.equal(completed.done.runId, waiting.runId);
  assert.equal(completed.done.status, "completed");
  assert.deepEqual(completed.record.data, { value: "saved draft" });
  assert.equal(await readFile(effects, "utf8"), "before\nafter\n");
  const history = await run(
    `console.log(JSON.stringify(await operations.listRuns()));await storage.dispose();`,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].historical, true);
  assert.equal(history[0].runId, waiting.runId);

  const another = await run(
    `const waiting=await mutate('run',{loomName:'fixture',input:{prompt:'deleted recovery'}});console.log(JSON.stringify(waiting));await storage.dispose();process.exit(0);`,
  );
  assert.equal(another.status, "waiting");
  await rm(join(project.root, ".intloom/runtime"), { recursive: true });
  assert.deepEqual(
    await run(
      `console.log(JSON.stringify(await operations.listRuns()));await storage.dispose();`,
    ),
    [],
  );
});
