import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { test } from "node:test";
import { compiledWorkflow } from "./initialization-fixture.ts";
import { projectFixture } from "./project-fixture.ts";
import { codeId } from "./workflow-fixture.ts";

const execute = promisify(execFile);
const kernelUrl = import.meta.resolve("@intloom/kernel");
const storageUrl = import.meta.resolve("@intloom/kernel/storage/file");

test("independent Node processes restore an exact waiting action and commit once through built package entries", async (t) => {
  const project = await projectFixture(t);
  const effects = join(project.root, "effects.txt");
  await project.add(
    "recoverable-flow",
    compiledWorkflow("fixture", codeId).replace(
      /export const codes = .*;/u,
      `import { appendFileSync } from 'node:fs';
const code = async (_input, access) => {
  appendFileSync(${JSON.stringify(effects)}, 'before\\n');
  await access.state.update({value:'saved draft'});
  const answer = await access.interaction.confirm('Save this draft?');
  return finish(answer, access);
};
async function finish(answer, access) {
  if (!answer.isConfirmed || access.state.value.value !== 'saved draft') throw new Error('Invalid recovery');
  await access.storage.commit([{type:'append_record',id:'saved-once',payload:{flowName:'fixture',stageName:'first',data:access.state.value}}]);
  appendFileSync(${JSON.stringify(effects)}, 'after\\n');
  return {outcome:'complete'};
}
code.recover = (saved, access) => finish(saved.answer, access);
export const codes = { [${JSON.stringify(codeId)}]: code };`,
    ),
  );
  const prefix = `
import {initializeProject, createEffector, flow, listRuns, answerAsk} from ${JSON.stringify(kernelUrl)};
import {openFileStorage} from ${JSON.stringify(storageUrl)};
const root=${JSON.stringify(project.root)};
const storage=await openFileStorage({directory:root+'/store'});
const execution=await initializeProject(root,{storage:storage.access,effector:createEffector(),runtimeDirectory:root+'/.intloom/runtime'});
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
const waiting=await flow(execution,'fixture','original request');
console.log(JSON.stringify(waiting));
await storage.dispose();
process.exit(0); // Exit without Runtime shutdown or cancellation.
`);
  assert.equal(waiting.status, "waiting");
  const completed = await run(`
const [waiting]=await listRuns(execution);
if(waiting.pendingAction.id!==${JSON.stringify(waiting.pendingAction.id)})throw new Error('Action changed');
const done=await answerAsk(execution,waiting.runId,waiting.pendingAction.id,{isConfirmed:true});
console.log(JSON.stringify({done,record:await storage.access.getRecordById('saved-once')}));
await execution.runtime.suspend();await storage.dispose();
`);
  assert.equal(completed.done.runId, waiting.runId);
  assert.equal(completed.done.status, "completed");
  assert.deepEqual(completed.record.data, { value: "saved draft" });
  assert.equal(await readFile(effects, "utf8"), "before\nafter\n");
  assert.deepEqual(
    await run(
      `console.log(JSON.stringify(await listRuns(execution)));await storage.dispose();`,
    ),
    [],
  );

  const another = await run(
    `const waiting=await flow(execution,'fixture','deleted recovery');console.log(JSON.stringify(waiting));await storage.dispose();process.exit(0);`,
  );
  assert.equal(another.status, "waiting");
  await rm(join(project.root, ".intloom/runtime"), { recursive: true });
  assert.deepEqual(
    await run(
      `console.log(JSON.stringify(await listRuns(execution)));await storage.dispose();`,
    ),
    [],
  );
});
