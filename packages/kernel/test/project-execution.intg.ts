import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerAsk,
  getRun,
  initializeProject,
  listRuns,
  listWorkflows,
  flow,
  cancelRun,
} from "@intloom/kernel";
import { compiledWorkflow } from "./initialization-fixture.ts";
import { askingCode, projectFixture } from "./project-fixture.ts";
import { runtimeFixture } from "./runtime-fixture.ts";
import { codeId } from "./workflow-fixture.ts";

test("built project API loads a compiled dependency and resumes its retained Runtime", async (t) => {
  const project = await projectFixture(t);
  await project.add(
    "fixture-flow",
    compiledWorkflow("fixture", codeId).replace(
      /export const codes = .*;/u,
      askingCode(codeId),
    ),
  );
  const fixture = runtimeFixture();
  const execution = await initializeProject(project.root, fixture.options);
  assert.deepEqual(await listWorkflows(execution), [
    {
      packageName: "fixture-flow",
      flowName: "fixture",
      isAvailable: true,
      readiness: {
        source: "cli",
        agentExecutor: "service",
        status: "available",
      },
    },
  ]);
  const waiting = await flow(execution, "fixture", "build input");
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

  const second = await flow(execution, "fixture", "stop input");
  await cancelRun(execution, second.runId);
  const stopped = await getRun(execution, second.runId);
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.lastError?.code, "RUN_STOPPED");
  assert.equal((await getRun(execution, waiting.runId)).status, "completed");
});
