import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createCliCore } from "@intloom/cli";
import { projectFixture } from "./project-fixture.ts";
const execute = promisify(execFile);
test("actual OpenTUI/Solid view observes Core, preserves CJK multiline input, resizes and closes without cancelling", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t),
    core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const serviceInstanceId = started.data.service.instanceId;
  const created = await core.flow({
    projectPath,
    serviceInstanceId,
    operationId: randomUUID(),
    flowName: "fixture",
    intent: "TUI observation",
  });
  assert.ok(created.ok && created.data.run);
  const runId = created.data.run.runId;
  const waiting = await core.waitRun({ projectPath, serviceInstanceId, runId });
  assert.ok(waiting.ok && waiting.data.run.pendingAction);
  const require = createRequire(new URL("../package.json", import.meta.url));
  const solid = pathToFileURL(require.resolve("@opentui/solid")).href;
  const app = new URL("../dist/tui/app.js", import.meta.url).href;
  const script = `
import assert from 'node:assert/strict';
import {testRender} from ${JSON.stringify(solid)};
import {App} from ${JSON.stringify(app)};
const view=await testRender(()=>App({projectPath:process.argv[1]}),{width:100,height:30});
async function frame(matcher){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,20));await view.flush();const frame=view.captureCharFrame();if(matcher.test(frame))return frame;}throw new Error('Expected UI frame missing: '+view.captureCharFrame());}
try {
 await frame(/running/);
 view.mockInput.pressKey('l',{ctrl:true}); await frame(/fixture/);
 view.mockInput.pressEnter(); const run=await frame(/waiting/); assert.match(run,/human_wait/);
 view.mockInput.pressEnter(); await frame(/Where should it be deployed/);
 view.mockInput.pressEnter(); await frame(/Any additional notes/);
 view.mockInput.pressKey('r',{ctrl:true});
 await new Promise(r=>setTimeout(r,1200)); await view.flush();
 const refreshed=view.captureCharFrame();assert.match(refreshed,/Any additional notes/);assert.doesNotMatch(refreshed,/Where should it be deployed/);
 view.mockInput.pressKey('n',{ctrl:true}); await frame(/fixture/);view.mockInput.pressEnter(); await frame(/Ctrl.Enter/);
 await view.mockInput.pasteBracketedText('第一行中文\\nsecond line --literal');await view.flush();const text=view.captureCharFrame();assert.match(text,/第一行中文/);assert.match(text,/second line --literal/);
 view.resize(60,24);await view.flush();assert.match(view.captureCharFrame(),/IntLoom/);
} finally {await view.dispose();}
process.stdout.write(JSON.stringify({closed:true}));
`;
  const result = await execute(
    process.execPath,
    ["--experimental-ffi", "--input-type=module", "-e", script, projectPath],
    { timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  assert.equal(JSON.parse(result.stdout).closed, true);
  const after = await core.getRun({ projectPath, serviceInstanceId, runId });
  assert.ok(after.ok);
  assert.equal(after.data.pendingAction?.id, waiting.data.run.pendingAction.id);
  assert.equal(after.data.status, "waiting");
});
