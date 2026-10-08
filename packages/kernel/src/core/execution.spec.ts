import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { runtimeFixture } from "../../test/runtime-fixture.ts";
import { createRuntime } from "../runtime/create-runtime.ts";
import type { ProjectExecution } from "./contracts.ts";
import {
  answerAsk,
  getRun,
  listRuns,
  listWorkflows,
  flow,
  cancelRun,
  cancelAllRuns,
} from "./execution.ts";

function fixture() {
  const f = runtimeFixture();
  const execution: ProjectExecution = {
    executionStatus: () => ({
      useMcpAgent: true,
      serviceConfigured: true,
      preparedServiceAgents: 0,
    }),
    projectRoot: "/fixture",
    executionReadiness: (_blueprint, source) => ({
      source,
      agentExecutor: "service",
      status: "available",
    }),
    registries: {
      blueprints: { fixture: f.blueprint },
      codes: f.codes,
      agents: {},
      sources: {},
    },
    runtime: createRuntime(f.options),
    workflows: [
      {
        packageName: "@fixture/workflow",
        flowName: "fixture",
        isAvailable: true,
      },
    ],
  };
  return { ...f, execution };
}

test("module functions observe and restore the same Runtime without adding a Kernel object", async (t) => {
  const f = fixture();
  t.after(() => cancelAllRuns(f.execution));
  let calls = 0;
  f.codes.start = async (_input, access) => {
    calls++;
    await access.interaction.confirm("Continue?");
    return { outcome: "complete" };
  };
  const waiting = await flow(f.execution, "fixture", "original text");
  assert.equal("flow" in f.execution, false);
  assert.equal(waiting.status, "waiting");
  assert.ok(waiting.pendingAction);
  assert.deepEqual(await getRun(f.execution, waiting.runId), waiting);
  assert.deepEqual(await listRuns(f.execution, "fixture"), [waiting]);
  const completed = await answerAsk(
    f.execution,
    waiting.runId,
    waiting.pendingAction.id,
    { isConfirmed: true },
  );
  assert.equal(completed.status, "completed");
  assert.equal(calls, 1);
  assert.deepEqual(await f.execution.runtime.getRun(waiting.runId), completed);
  assert.deepEqual(await listRuns(f.execution, "other"), []);
});

test("validates names and accepts only explicitly registered Blueprint keys", async () => {
  const f = fixture();
  await assert.rejects(flow(f.execution, " ", "text"), {
    code: "INVALID_REQUEST",
  });
  for (const name of ["absent", "constructor", "toString", " fixture "])
    await assert.rejects(flow(f.execution, name, "text"), {
      code: "NOT_FOUND",
    });
  await assert.rejects(flow(f.execution, "fixture", " \n "), {
    code: "INVALID_REQUEST",
  });
  assert.deepEqual(await listRuns(f.execution), []);
  const inherited: ProjectExecution = {
    ...f.execution,
    registries: {
      ...f.execution.registries,
      blueprints: Object.create({ fixture: f.blueprint }),
    },
  };
  await assert.rejects(flow(inherited, "fixture", "text"), {
    code: "NOT_FOUND",
  });
});

test("an available Flow wins over a later same-name failure and unavailable Flows preserve their cause", async () => {
  const f = fixture();
  const error = new LoomError(
    "WORKFLOW_CONFLICT",
    "Private registration error",
  );
  const execution: ProjectExecution = {
    ...f.execution,
    workflows: [
      ...f.execution.workflows,
      {
        packageName: "@fixture/conflict",
        flowName: "fixture",
        isAvailable: false,
        phase: "register",
        error,
      },
      {
        packageName: "@fixture/broken",
        flowName: "broken",
        isAvailable: false,
        phase: "agent",
        error,
      },
      { packageName: "unknown-name", isAvailable: false, phase: "load", error },
    ],
  };
  assert.equal((await flow(execution, "fixture", "text")).status, "completed");
  await assert.rejects(flow(execution, "broken", "text"), (cause: unknown) => {
    assert.ok(
      cause instanceof Error && "code" in cause && "retryable" in cause,
    );
    assert.equal(cause.code, "KERNEL_UNAVAILABLE");
    assert.equal(cause.retryable, false);
    assert.equal(cause.cause, error);
    return true;
  });
  await assert.rejects(flow(execution, "unknown-name", "text"), {
    code: "NOT_FOUND",
  });
});

test("Workflow diagnostics are independent JSON projections and omit unknown Workflow names", async () => {
  const f = fixture();
  const error = new LoomError("WORKFLOW_LOAD_FAILED", "Cannot load Workflow", {
    cause: new Error("private cause"),
  });
  const execution: ProjectExecution = {
    ...f.execution,
    workflows: [
      ...f.execution.workflows,
      {
        packageName: "@fixture/broken",
        isAvailable: false,
        phase: "load",
        error,
      },
    ],
  };
  const view = await listWorkflows(execution);
  const failed = view[1];
  assert.ok(failed && !failed.isAvailable);
  assert.equal("flowName" in failed, false);
  assert.equal("cause" in failed.error, false);
  assert.equal("stack" in failed.error, false);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  Object.assign(failed.error, { message: "caller mutation" });
  assert.equal(error.message, "Cannot load Workflow");
  assert.notDeepEqual(await listWorkflows(execution), view);
});

test("module cancelRun cancels the same Run and leaves borrowed resource disposal to the host", async () => {
  const f = fixture();
  let disposals = 0;
  Object.assign(f.storage, {
    dispose: async () => {
      disposals++;
    },
  });
  f.codes.start = async (_input, access) => {
    assert.equal("dispose" in access.storage, false);
    await access.interaction.confirm("Continue?");
    return { outcome: "complete" };
  };
  const waiting = await flow(f.execution, "fixture", "text");
  await cancelRun(f.execution, waiting.runId);
  assert.equal(
    (await getRun(f.execution, waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  assert.equal(disposals, 0);
  await cancelAllRuns(f.execution);
});
