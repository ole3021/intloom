import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import * as z from "zod";
import { runtimeFixture, deferred } from "../../../test/runtime-fixture.ts";
import { createRuntime } from "../create-runtime.ts";
import type { Runtime } from "../contracts.ts";
import type { ExecutableCode } from "../../effector/execution.ts";
import { checkpointSchema, openRunCheckpointStore } from "./store.ts";

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "intloom-recovery-"));
  const f = runtimeFixture();
  const runtimes: Runtime[] = [];
  const recovery = () => ({
    store: openRunCheckpointStore(directory),
    blueprints: { fixture: f.blueprint },
    workflowIdentities: { fixture: "fixture-version-one" },
  });
  function runtime() {
    const runtime = createRuntime({ ...f.options, recovery: recovery() });
    runtimes.push(runtime);
    return runtime;
  }
  t.after(async () => {
    for (const runtime of runtimes) await runtime.suspend();
    rmSync(directory, { recursive: true, force: true });
  });
  return { ...f, directory, runtime, recovery };
}

async function terminal(runtime: Runtime, runId: string) {
  for (let i = 0; i < 1000; i++) {
    const run = await runtime.getRun(runId);
    if (run.status !== "running") return run;
    await setImmediate();
  }
  throw new Error("Run did not reach a stable state.");
}

test("reopens the same question and uses explicit recovery without repeating Code or Stage initialization", async (t) => {
  const f = fixture(t);
  let originalCalls = 0;
  let recoveryCalls = 0;
  const code: ExecutableCode = async (_input, access) => {
    originalCalls++;
    await access.state.update({ intent: "persisted draft", value: 7 });
    await access.interaction.confirm("Save the draft?");
    throw new Error("The old continuation must never run after suspension.");
  };
  code.recover = async (saved, access) => {
    recoveryCalls++;
    assert.deepEqual(saved.answer, { isConfirmed: true });
    assert.deepEqual(access.state.value, {
      intent: "persisted draft",
      value: 7,
    });
    return { outcome: "complete" };
  };
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.flow(f.blueprint, "original");
  assert.ok(waiting.pendingAction);
  const persisted = openRunCheckpointStore(f.directory).read()[0];
  assert.ok(persisted);
  assert.equal(persisted.phase, "waiting");
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.deepEqual(await second.getRun(waiting.runId), waiting);
  await assert.rejects(
    second.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: "yes",
    }),
    { code: "INVALID_REQUEST" },
  );
  const replies = await Promise.allSettled([
    second.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: true,
    }),
    second.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: true,
    }),
  ]);
  assert.equal(
    replies.filter((reply) => reply.status === "fulfilled").length,
    1,
  );
  assert.equal((await second.getRun(waiting.runId)).status, "completed");
  assert.equal(originalCalls, 1);
  assert.equal(recoveryCalls, 1);
  assert.equal(
    f.contexts.filter((context) => context.stageName === "first").length,
    1,
  );
  assert.equal(
    openRunCheckpointStore(f.directory).read()[0]?.phase,
    "terminal",
  );
  const third = f.runtime();
  await third.restore();
  assert.deepEqual(await third.listRuns(), []);
});

test("accepted answer survives failure before its handler starts", async (t) => {
  const f = fixture(t);
  const code: ExecutableCode = async (_input, access) => {
    await access.interaction.confirm("Accept?");
    throw new Error("Original answer handler must not run.");
  };
  let recovered = 0;
  code.recover = (saved) => {
    assert.deepEqual(saved.answer, { isConfirmed: true });
    recovered++;
    return { outcome: "complete" };
  };
  f.codes.start = code;
  const recovery = f.recovery();
  const write = recovery.store.write;
  let interrupt = false;
  recovery.store.write = (input) => {
    const checkpoint = checkpointSchema.parse(input);
    if (interrupt && checkpoint.phase === "executing")
      throw new Error("Simulated process interruption");
    write(input);
  };
  const first = createRuntime({ ...f.options, recovery });
  const waiting = await first.flow(f.blueprint, "answer");
  assert.ok(waiting.pendingAction);
  interrupt = true;
  await assert.rejects(
    first.answerAsk(waiting.runId, waiting.pendingAction.id, {
      isConfirmed: true,
    }),
    { code: "RUN_CHECKPOINT_FAILED" },
  );
  assert.equal(
    openRunCheckpointStore(f.directory).read()[0]?.phase,
    "answered",
  );
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.equal((await terminal(second, waiting.runId)).status, "completed");
  assert.equal(recovered, 1);
});

test("a persisted Step result advances routing without repeating its effect", async (t) => {
  const f = fixture(t);
  let effects = 0;
  f.codes.start = () => {
    effects++;
    return { outcome: "complete" };
  };
  const recovery = f.recovery();
  const write = recovery.store.write;
  recovery.store.write = (input) => {
    const checkpoint = checkpointSchema.parse(input);
    if (
      checkpoint.phase === "step_ready" &&
      checkpoint.run.cursor.stepName === "review"
    )
      throw new Error("Interrupted after saving result");
    write(input);
  };
  const first = createRuntime({ ...f.options, recovery });
  const failed = await first.flow(f.blueprint, "effect");
  assert.equal(failed.lastError?.code, "RUN_CHECKPOINT_FAILED");
  assert.equal(
    openRunCheckpointStore(f.directory).read()[0]?.phase,
    "step_result",
  );
  const second = f.runtime();
  await second.restore();
  assert.equal((await terminal(second, failed.runId)).status, "completed");
  assert.equal(effects, 1);
});

test("in-flight effects are not replayed and their diagnostic checkpoint is retained", async (t) => {
  const f = fixture(t);
  const gate = deferred();
  let effects = 0;
  f.codes.start = async () => {
    effects++;
    await gate.promise;
    return { outcome: "complete" };
  };
  const first = f.runtime();
  const pending = first.flow(f.blueprint, "uncertain");
  while (!effects) await setImmediate();
  const [running] = await first.listRuns();
  assert.ok(running);
  await first.suspend();
  await pending;
  gate.resolve();
  const second = f.runtime();
  await second.restore();
  assert.equal(
    (await second.getRun(running.runId)).lastError?.code,
    "RUN_INTERRUPTED",
  );
  assert.equal(effects, 1);
  assert.equal(
    openRunCheckpointStore(f.directory).read()[0]?.phase,
    "executing",
  );
});

test("disk changes do not replace live memory and explicit deletion opts out of recovery", async (t) => {
  const f = fixture(t);
  const code: ExecutableCode = async (_input, access) => {
    await access.interaction.confirm("Original question");
    return { outcome: "complete" };
  };
  code.recover = () => ({ outcome: "complete" });
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.flow(f.blueprint, "original intent");
  const savedName = readdirSync(f.directory).find((file) =>
    file.endsWith(".json"),
  );
  assert.ok(savedName);
  const filename = join(f.directory, savedName);
  const saved = JSON.parse(readFileSync(filename, "utf8"));
  saved.run.intent = "external edit";
  writeFileSync(filename, JSON.stringify(saved));
  assert.deepEqual(await first.getRun(waiting.runId), waiting);
  rmSync(filename);
  await first.cancelRun(waiting.runId);
  assert.equal(readdirSync(f.directory).length, 0);
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.deepEqual(await second.listRuns(), []);
});

test("Workflow mismatch and corrupted snapshots fail restoration without executing or deleting evidence", async (t) => {
  const f = fixture(t);
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("Wait");
    return { outcome: "complete" };
  };
  const first = f.runtime();
  await first.flow(f.blueprint, "version");
  await first.suspend();
  const recovery = f.recovery();
  recovery.workflowIdentities.fixture = "changed";
  await assert.rejects(createRuntime({ ...f.options, recovery }).restore(), {
    code: "KERNEL_UNAVAILABLE",
  });
  assert.equal(openRunCheckpointStore(f.directory).read().length, 1);
  const savedName = readdirSync(f.directory).find((file) =>
    file.endsWith(".json"),
  );
  assert.ok(savedName);
  const filename = join(f.directory, savedName);
  writeFileSync(filename, "broken");
  await assert.rejects(f.runtime().restore());
  assert.equal(readFileSync(filename, "utf8"), "broken");
});

test("Stage transforms validate original inputs on recovery without transforming persisted outputs twice", async (t) => {
  const f = fixture(t);
  Object.assign(f.first, {
    stateSchema: z.object({
      intent: z.string(),
      value: z.string().transform((value) => Number(value) + 1),
    }),
    initializeState: () => ({ intent: "transform", value: "4" }),
  });
  const code: ExecutableCode = async (_input, access) => {
    await access.interaction.confirm("Transform");
    return { outcome: "complete" };
  };
  code.recover = (_saved, access) => {
    assert.deepEqual(access.state.value, { intent: "transform", value: 5 });
    return { outcome: "complete" };
  };
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.flow(f.blueprint, "transform");
  assert.ok(waiting.pendingAction);
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.equal(
    (
      await second.answerAsk(waiting.runId, waiting.pendingAction.id, {
        isConfirmed: true,
      })
    ).status,
    "completed",
  );
});

test("explicit cancellation is terminal while another Run's waiting checkpoint survives", async (t) => {
  const f = fixture(t);
  const code: ExecutableCode = async (_input, access) => {
    await access.interaction.confirm("Wait");
    return { outcome: "complete" };
  };
  code.recover = () => ({ outcome: "complete" });
  f.codes.start = code;
  const first = f.runtime();
  const cancelled = await first.flow(f.blueprint, "cancel");
  const retained = await first.flow(f.blueprint, "retain");
  await first.cancelRun(cancelled.runId);
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.deepEqual(await second.listRuns(), [retained]);
  assert.equal(openRunCheckpointStore(f.directory).read().length, 2);
});

test("a waiting checkpoint failure is surfaced before exposing the question", async (t) => {
  const f = fixture(t);
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("Must be durable");
    return { outcome: "complete" };
  };
  const recovery = f.recovery();
  const write = recovery.store.write;
  recovery.store.write = (input) => {
    if (checkpointSchema.parse(input).phase === "waiting")
      throw new Error("Disk unavailable");
    write(input);
  };
  const runtime = createRuntime({ ...f.options, recovery });
  const failed = await runtime.flow(f.blueprint, "checkpoint failure");
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError?.code, "RUN_CHECKPOINT_FAILED");
  assert.equal(failed.pendingAction, undefined);
});

test("cancellation revokes the original continuation even when its terminal checkpoint cannot be written", async (t) => {
  const f = fixture(t);
  let signal: AbortSignal | undefined;
  let finished = false;
  f.codes.start = async (_input, access) => {
    signal = access.signal;
    try {
      await access.interaction.confirm("Wait");
    } finally {
      finished = true;
    }
    return { outcome: "complete" };
  };
  const recovery = f.recovery();
  const write = recovery.store.write;
  recovery.store.write = (input) => {
    if (checkpointSchema.parse(input).phase === "terminal")
      throw new Error("Disk unavailable");
    write(input);
  };
  const runtime = createRuntime({ ...f.options, recovery });
  const waiting = await runtime.flow(f.blueprint, "cancel failure");
  await assert.rejects(runtime.cancelRun(waiting.runId), {
    code: "RUN_CHECKPOINT_FAILED",
  });
  await setImmediate();
  assert.equal(signal?.aborted, true);
  assert.equal(finished, true);
});
