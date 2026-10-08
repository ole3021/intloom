import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { compiledWorkflow } from "../../test/initialization-fixture.ts";
import {
  askingCode,
  configText,
  projectFixture,
} from "../../test/project-fixture.ts";
import { runtimeFixture } from "../../test/runtime-fixture.ts";
import { codeId, agentId } from "../../test/workflow-fixture.ts";
import {
  answerAsk,
  getRun,
  listRuns,
  listWorkflows,
  flow,
  cancelAllRuns,
} from "./execution.ts";
import { initializeProject } from "./initialize-project.ts";

test("initializes stable Registries and an idle Runtime without creating a Kernel facade", async (t) => {
  const project = await projectFixture(t);
  await project.add(
    "@test/workflow",
    compiledWorkflow("fixture", codeId),
    true,
  );
  const f = runtimeFixture();
  const execution = await initializeProject(project.root, f.options);
  t.after(() => cancelAllRuns(execution));
  assert.equal(execution.projectRoot, project.root);
  assert.equal(Object.isFrozen(execution), true);
  assert.equal(Object.isFrozen(execution.registries.codes), true);
  assert.equal("flow" in execution, false);
  assert.equal("state" in execution, false);
  assert.deepEqual(await listRuns(execution), []);
  assert.equal((await flow(execution, "fixture", "text")).status, "completed");
});

test("separate project environments isolate Runs with identical Flow and resource IDs", async (t) => {
  const a = await projectFixture(t);
  const b = await projectFixture(t);
  const body = compiledWorkflow("fixture", codeId).replace(
    /export const codes = .*;/u,
    askingCode(codeId),
  );
  await a.add("@test/workflow", body);
  await b.add("@test/workflow", body);
  const fa = runtimeFixture();
  const fb = runtimeFixture();
  const readA = t.mock.method(fa.storage, "getArtifact", async () => undefined);
  const readB = t.mock.method(fb.storage, "getArtifact", async () => undefined);
  const ea = await initializeProject(a.root, fa.options);
  const eb = await initializeProject(b.root, fb.options);
  t.after(async () => {
    await cancelAllRuns(ea);
    await cancelAllRuns(eb);
  });
  const va = await flow(ea, "fixture", "A");
  const vb = await flow(eb, "fixture", "B");
  assert.ok(va.pendingAction && vb.pendingAction);
  assert.notEqual(ea.runtime, eb.runtime);
  assert.notEqual(ea.registries, eb.registries);
  await assert.rejects(
    answerAsk(eb, va.runId, va.pendingAction.id, { isConfirmed: true }),
    { code: "NOT_FOUND" },
  );
  assert.equal(
    (await answerAsk(ea, va.runId, va.pendingAction.id, { isConfirmed: true }))
      .status,
    "completed",
  );
  assert.deepEqual(await getRun(eb, vb.runId), vb);
  await cancelAllRuns(eb);
  assert.equal((await getRun(eb, vb.runId)).lastError?.code, "RUN_STOPPED");
  assert.equal((await getRun(ea, va.runId)).status, "completed");
  assert.equal(readA.mock.calls.length, 1);
  assert.equal(readB.mock.calls.length, 1);
});

test("reinitializing one project creates a new environment and never replaces the host's previous Runtime", async (t) => {
  const project = await projectFixture(t);
  const body = compiledWorkflow("fixture", codeId).replace(
    /export const codes = .*;/u,
    askingCode(codeId),
  );
  await project.add("@test/workflow", body);
  const f = runtimeFixture();
  const original = await initializeProject(project.root, f.options);
  const waiting = await flow(original, "fixture", "text");
  const newer = await initializeProject(project.root, f.options);
  t.after(async () => {
    await cancelAllRuns(original);
    await cancelAllRuns(newer);
  });
  assert.notEqual(original.runtime, newer.runtime);
  assert.deepEqual(await listRuns(newer), []);
  assert.deepEqual(await getRun(original, waiting.runId), waiting);
  await assert.rejects(getRun(newer, waiting.runId), { code: "NOT_FOUND" });
});

test("empty or fully unavailable dependencies still produce a diagnosable environment", async (t) => {
  const project = await projectFixture(t);
  const f = runtimeFixture();
  const empty = await initializeProject(project.root, f.options);
  assert.deepEqual(await listWorkflows(empty), []);
  assert.deepEqual(await listRuns(empty), []);
  await project.add(
    "@test/broken",
    compiledWorkflow("broken", codeId, { [agentId]: "reasoning" }),
  );
  const previous = process.env.INTLOOM_N5_MISSING_TEST_KEY;
  delete process.env.INTLOOM_N5_MISSING_TEST_KEY;
  t.after(() => {
    if (previous !== undefined)
      process.env.INTLOOM_N5_MISSING_TEST_KEY = previous;
  });
  await project.configure(
    configText.replace(
      "INTLOOM_WORKFLOW_TEST_KEY",
      "INTLOOM_N5_MISSING_TEST_KEY",
    ),
  );
  const unavailable = await initializeProject(project.root, f.options);
  const [failure] = await listWorkflows(unavailable);
  assert.ok(failure?.isAvailable);
  assert.equal(failure.readiness?.status, "available");
  assert.deepEqual(Object.keys(unavailable.registries.blueprints), ["broken"]);
  const agent = unavailable.registries.agents[agentId];
  assert.ok(agent);
  assert.equal("agent" in agent, false);
});

test("fatal initialization preserves the cause and does not close borrowed host resources", async (t) => {
  const project = await projectFixture(t);
  const f = runtimeFixture();
  let disposals = 0;
  Object.assign(f.storage, {
    dispose: async () => {
      disposals++;
    },
  });
  await writeFile(resolve(project.root, "intloom.yaml"), "[]");
  await assert.rejects(initializeProject(project.root, f.options), {
    code: "INVALID_REQUEST",
  });
  assert.equal(disposals, 0);
});
