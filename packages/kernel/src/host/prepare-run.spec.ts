import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prepareRun } from "./prepare-run.ts";
import { createRuntime } from "../runtime/create-runtime.ts";
import { deferred, runtimeFixture } from "../../test/runtime-fixture.ts";
import { failure } from "../errors.ts";
import { unwrapMutation } from "../runtime/mutation.ts";

test("shutdown during model preparation rejects admission before registering or starting a Run", async () => {
  const f = runtimeFixture();
  const entered = deferred();
  const release = deferred();
  const runtime = createRuntime(f.options);
  let closed = false;
  const execution = {
    runtime,
    looms: [],
    registries: {
      blueprints: { fixture: f.blueprint },
      codes: f.codes,
      agents: {},
      sources: {},
    },
    async prepareExecution() {
      entered.resolve();
      await release.promise;
      return { source: "cli", agentExecutor: "service" } as const;
    },
  };
  const pending = prepareRun(
    execution,
    "fixture",
    { prompt: "task" },
    "cli",
    { serviceInstanceId: randomUUID(), operationId: randomUUID() },
    () => {
      if (closed) throw failure("CLI_SERVICE_CLOSING", "Closing");
    },
  );
  await entered.promise;
  closed = true;
  release.resolve();
  const result = await pending;
  assert.equal(result.status, "not_applied");
  assert.throws(() => unwrapMutation(result), { code: "CLI_SERVICE_CLOSING" });
  assert.deepEqual(await runtime.listRuns(), []);
  assert.deepEqual(f.events, []);
});
