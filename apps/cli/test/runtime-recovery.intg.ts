import assert from "node:assert/strict";
import { appendFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { connectProject, startService, stopService } from "@intloom/cli";
import {
  projectFixture,
  refreshFixtureInstallation,
} from "./project-fixture.ts";

for (const storage of ["file", "sqlite"] as const) {
  test(`${storage}: host stop/start restores a question without repeating a committed effect; deletion abandons recovery`, async (t) => {
    const root = await projectFixture(t, true, storage);
    await appendFile(
      join(
        root,
        ".intloom/workflows/node_modules/fixture-workflow/workflow.js",
      ),
      `
const finish = async (saved, access) => {
  if (!saved.answer.isConfirmed) throw new Error('Confirmation required');
  const {id,intent} = access.state.value;
  await access.storage.commit([{type:'append_record',id,payload:{flowName:'fixture',stageName:'first',data:{intent}}}]);
  return {outcome:'complete'};
};
const recoverable = async (_input, access) => {
  const {id,intent}=access.state.value;
  await access.storage.commit([{type:'append_record',id:'once-'+id,payload:{flowName:'fixture',stageName:'first',data:{intent}}}]);
  return finish({answer:await access.interaction.confirm('Save?')},access);
};
recoverable.recover=finish;
codes['CODE-123456789012345678901']=recoverable;
`,
    );
    await refreshFixtureInstallation(root);
    await startService({ projectRoot: root });
    let client = await connectProject(root);
    t.after(() => client.close());
    const waiting = await client.flow("fixture", "survive restart");
    assert.equal(waiting.status, "waiting");
    assert.ok(waiting.pendingAction);
    const once = await client.getRecord(`once-${waiting.runId}`);
    assert.ok(once);
    await client.close();
    await stopService(root);
    assert.equal((await readdir(join(root, ".intloom/runtime"))).length, 1);
    await startService({ projectRoot: root });
    client = await connectProject(root);
    assert.deepEqual(await client.getRun(waiting.runId), waiting);
    assert.deepEqual(await client.getRecord(`once-${waiting.runId}`), once);
    const done = await client.answerAsk(
      waiting.runId,
      waiting.pendingAction.id,
      { isConfirmed: true },
    );
    assert.equal(done.status, "completed", JSON.stringify(done.lastError));
    const record = await client.getRecord(done.runId);
    assert.ok(record);

    const abandoned = await client.flow("fixture", "abandon by deleting files");
    assert.equal(abandoned.status, "waiting");
    await rm(join(root, ".intloom/runtime"), { recursive: true });
    await client.close();
    await stopService(root);
    await startService({ projectRoot: root });
    client = await connectProject(root);
    assert.deepEqual(await client.listRuns(), []);
    assert.deepEqual(await client.getRecord(done.runId), record);
  });
}
