import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerAsk,
  getRun,
  listRuns,
  listLooms,
  run,
  cancelRun,
} from "./operations-harness.ts";
import { initializeProject } from "../src/host/create-project-execution.ts";
import { compiledLoom } from "./initialization-fixture.ts";
import { askingCode, projectFixture } from "./project-fixture.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { codeId } from "./loom-fixture.ts";

test("Host loads a compiled dependency and resumes its retained Runtime", async (t) => {
  const project = await projectFixture(t);
  await project.add(
    "fixture-run",
    compiledLoom("fixture", codeId).replace(
      /export const codes = .*;/u,
      askingCode(codeId),
    ),
  );
  const fixture = runtimeFixture();
  const execution = await initializeProject(project.root, fixture.options);
  assert.deepEqual(await listLooms(execution), [
    {
      packageName: "fixture-run",
      loomName: "fixture",
      isAvailable: true,
      inputs: ["prompt"],
      readiness: {
        source: "cli",
        agentExecutor: "service",
        status: "available",
      },
    },
  ]);
  const waiting = await run(execution, "fixture", { prompt: "build input" });
  assert.equal(waiting.status, "waiting");
  assert.ok(waiting.pendingAction);
  assert.deepEqual(await getRun(execution, waiting.runId), waiting);
  const completed = await answerAsk(
    execution,
    waiting.runId,
    waiting.pendingAction.id,
    { isConfirmed: true },
  );
  assert.equal(completed.status, "completed");
  assert.deepEqual(await execution.runtime.getRun(waiting.runId), completed);
  assert.deepEqual(await listRuns(execution), [completed]);

  const second = await run(execution, "fixture", { prompt: "stop input" });
  await cancelRun(execution, second.runId);
  const stopped = await getRun(execution, second.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  assert.equal((await getRun(execution, waiting.runId)).status, "completed");
});
