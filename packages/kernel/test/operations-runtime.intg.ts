import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { runtimeFixture } from "./runtime-fixture.ts";
import { createRuntimeHarness } from "./runtime-harness.ts";
import type { ProjectExecution } from "../src/host/project-contracts.ts";
import {
  answerAsk,
  getRun,
  listRuns,
  listLooms,
  run,
  cancelRun,
  cancelAllRuns,
} from "./operations-harness.ts";

function fixture() {
  const f = runtimeFixture();
  const execution: ProjectExecution = {
    executor: f.options.executor,
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
    runtime: createRuntimeHarness(f.options).engine,
    prepareExecution: async (_blueprint, source) => ({
      source,
      agentExecutor: "service",
    }),
    looms: [
      {
        packageName: "@fixture/loom",
        loomName: "fixture",
        isAvailable: true,
      },
    ],
  };
  return { ...f, execution };
}

test("Operations admissions and queries use the Host-owned Runtime", async (t) => {
  const f = fixture();
  t.after(() => cancelAllRuns(f.execution));
  let calls = 0;
  f.codes.start = async (access) => {
    calls++;
    await access.interaction.confirm("Continue?");
    return { outcome: "complete" };
  };
  const waiting = await run(f.execution, "fixture", {
    prompt: "original text",
  });
  assert.equal("run" in f.execution, false);
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
  await assert.rejects(run(f.execution, " ", { prompt: "text" }), {
    code: "INVALID_REQUEST",
  });
  for (const name of ["absent", "constructor", "toString", " fixture "])
    await assert.rejects(run(f.execution, name, { prompt: "text" }), {
      code: "NOT_FOUND",
    });
  await assert.rejects(run(f.execution, "fixture", { prompt: " \n " }), {
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
  await assert.rejects(run(inherited, "fixture", { prompt: "text" }), {
    code: "NOT_FOUND",
  });
});

test("an available Loom wins over a later same-name failure and unavailable Looms project safe errors", async () => {
  const f = fixture();
  const error = new LoomError(
    "WORKFLOW_CONFLICT",
    "Private registration error",
  );
  const execution: ProjectExecution = {
    ...f.execution,
    looms: [
      ...f.execution.looms,
      {
        packageName: "@fixture/conflict",
        loomName: "fixture",
        isAvailable: false,
        phase: "register",
        error,
      },
      {
        packageName: "@fixture/broken",
        loomName: "broken",
        isAvailable: false,
        phase: "agent",
        error,
      },
      { packageName: "unknown-name", isAvailable: false, phase: "load", error },
    ],
  };
  assert.equal(
    (await run(execution, "fixture", { prompt: "text" })).status,
    "completed",
  );
  await assert.rejects(
    run(execution, "broken", { prompt: "text" }),
    (cause: unknown) => {
      assert.ok(
        cause instanceof Error && "code" in cause && "retryable" in cause,
      );
      assert.equal(cause.code, "KERNEL_UNAVAILABLE");
      assert.equal(cause.retryable, false);
      assert.equal(cause.cause, undefined);
      return true;
    },
  );
  await assert.rejects(run(execution, "unknown-name", { prompt: "text" }), {
    code: "NOT_FOUND",
  });
});

test("Loom diagnostics are independent JSON projections and omit unknown Loom names", async () => {
  const f = fixture();
  const error = new LoomError("WORKFLOW_LOAD_FAILED", "Cannot load Loom", {
    cause: new Error("private cause"),
  });
  const execution: ProjectExecution = {
    ...f.execution,
    looms: [
      ...f.execution.looms,
      {
        packageName: "@fixture/broken",
        isAvailable: false,
        phase: "load",
        error,
      },
    ],
  };
  const view = await listLooms(execution);
  const failed = view[1];
  assert.ok(failed && !failed.isAvailable);
  assert.equal("loomName" in failed, false);
  assert.equal("cause" in failed.error, false);
  assert.equal("stack" in failed.error, false);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  Object.assign(failed.error, { message: "caller mutation" });
  assert.equal(error.message, "Cannot load Loom");
  assert.notDeepEqual(await listLooms(execution), view);
});

test("Operations stop cancels the same Run and leaves borrowed resource disposal to the host", async () => {
  const f = fixture();
  let disposals = 0;
  Object.assign(f.storage, {
    dispose: async () => {
      disposals++;
    },
  });
  f.codes.start = async (access) => {
    assert.equal("dispose" in access.storage, false);
    await access.interaction.confirm("Continue?");
    return { outcome: "complete" };
  };
  const waiting = await run(f.execution, "fixture", { prompt: "text" });
  await cancelRun(f.execution, waiting.runId);
  assert.equal(
    (await getRun(f.execution, waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  assert.equal(disposals, 0);
  await cancelAllRuns(f.execution);
});
