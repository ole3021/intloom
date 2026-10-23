import { waitForRun } from "../src/operations/wait-run.ts";
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
import { runtimeFixture, deferred } from "./runtime-fixture.ts";
import { createRuntimeHarness } from "./runtime-harness.ts";
import type { Runtime } from "../src/runtime/contracts.ts";
import type { ExecutableCode } from "@intloom/loom-sdk";
import { checkpointSnapshotSchema } from "../src/runtime/recovery/contracts.ts";
import { openRunCheckpointStore } from "../src/host/checkpoints/store.ts";

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "intloom-recovery-"));
  const f = runtimeFixture();
  const runtimes: Pick<Runtime, "suspend">[] = [];
  const recovery = () => ({
    store: openRunCheckpointStore(directory),
    blueprints: { fixture: f.blueprint },
    loomIdentities: { fixture: "fixture-version-one" },
  });
  function runtime() {
    const runtime = createRuntimeHarness({
      ...f.options,
      recovery: recovery(),
    });
    runtimes.push(runtime);
    return runtime;
  }
  t.after(async () => {
    for (const runtime of runtimes) await runtime.suspend();
    rmSync(directory, { recursive: true, force: true });
  });
  return { ...f, directory, runtime, recovery };
}

const terminal = (runtime: Pick<Runtime, "watchRun">, runId: string) =>
  waitForRun(runtime, runId, AbortSignal.timeout(5000));

test("reopens the same question and uses explicit recovery without repeating Code or Stage initialization", async (t) => {
  const f = fixture(t);
  let originalCalls = 0;
  let recoveryCalls = 0;
  const code: ExecutableCode = async (access) => {
    originalCalls++;
    await access.state.update({ intent: "persisted draft", value: 7 });
    await access.interaction.confirm("Save the draft?");
    throw new Error("The old continuation must never run after suspension.");
  };
  code.recover = async (saved, access) => {
    recoveryCalls++;
    assert.equal(saved.kind, "user_ask_confirmation");
    assert.deepEqual(saved.request, { context: "Save the draft?" });
    assert.equal(typeof saved.actionId, "string");
    assert.deepEqual(Object.keys(saved).sort(), [
      "actionId",
      "answer",
      "kind",
      "request",
    ]);
    assert.deepEqual(saved.answer, { isConfirmed: true });
    assert.deepEqual(access.state.value, {
      intent: "persisted draft",
      value: 7,
    });
    return { outcome: "complete" };
  };
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.run(f.blueprint, { prompt: "original" });
  assert.ok(waiting.pendingAction);
  const persisted = openRunCheckpointStore(f.directory).read()[0];
  assert.ok(persisted);
  assert.equal(persisted.phase, "waiting");
  const filename = readdirSync(f.directory).find((name) =>
    name.endsWith(".json"),
  );
  assert.ok(filename);
  const disk = JSON.parse(readFileSync(join(f.directory, filename), "utf8"));
  assert.equal(disk.version, 3);
  assert.equal(disk.boundary.kind, "user_waiting");
  assert.equal(disk.boundary.action.id, waiting.pendingAction.id);
  assert.equal(typeof disk.boundary.callId, "string");
  assert.equal("phase" in disk, false);
  assert.equal("pendingAction" in disk.run, false);
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
  assert.equal((await third.listRuns())[0]?.historical, true);
  assert.equal((await third.getRun(waiting.runId)).status, "completed");
  await assert.rejects(
    third.resumeRun(waiting.runId, { operationId: "history" }),
    { code: "NOT_FOUND" },
  );
});

test("accepted answer survives failure before its handler starts", async (t) => {
  const f = fixture(t);
  const code: ExecutableCode = async (access) => {
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
    const checkpoint = checkpointSnapshotSchema.parse(input);
    if (interrupt && checkpoint.phase === "executing")
      throw new Error("Simulated process interruption");
    write(input);
  };
  const first = createRuntimeHarness({ ...f.options, recovery });
  const waiting = await first.run(f.blueprint, { prompt: "answer" });
  assert.ok(waiting.pendingAction);
  interrupt = true;
  const accepted = first.submitAnswer(waiting.runId, waiting.pendingAction.id, {
    isConfirmed: true,
  });
  assert.equal(accepted.status, "running");
  const failed = await terminal(first, waiting.runId);
  assert.equal(failed.lastError?.code, "RUN_CHECKPOINT_FAILED");
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
    const checkpoint = checkpointSnapshotSchema.parse(input);
    if (
      checkpoint.phase === "step_ready" &&
      checkpoint.run.cursor.stepName === "review"
    )
      throw new Error("Interrupted after saving result");
    write(input);
  };
  const first = createRuntimeHarness({ ...f.options, recovery });
  const failed = await first.run(f.blueprint, { prompt: "effect" });
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
  const pending = first.run(f.blueprint, { prompt: "uncertain" });
  while (!effects) await setImmediate();
  const [running] = await first.listRuns();
  assert.ok(running);
  const stopping = first.suspend();
  await pending;
  // Suspension revokes the call before awaiting known effect cleanup.
  gate.resolve();
  await stopping;
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
  const code: ExecutableCode = async (access) => {
    await access.interaction.confirm("Original question");
    return { outcome: "complete" };
  };
  code.recover = () => ({ outcome: "complete" });
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.run(f.blueprint, { prompt: "original intent" });
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

test("Loom mismatch and corrupted snapshots fail restoration without executing or deleting evidence", async (t) => {
  const f = fixture(t);
  f.codes.start = async (access) => {
    await access.interaction.confirm("Wait");
    return { outcome: "complete" };
  };
  const first = f.runtime();
  await first.run(f.blueprint, { prompt: "version" });
  await first.suspend();
  const recovery = f.recovery();
  recovery.loomIdentities.fixture = "changed";
  await assert.rejects(
    createRuntimeHarness({ ...f.options, recovery }).restore(),
    {
      code: "RECOVERY_INCOMPATIBLE",
    },
  );
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

for (const version of [1, 2])
  test(`checkpoint format ${version} is rejected without migration or execution`, async (t) => {
    const f = fixture(t);
    let calls = 0;
    f.codes.start = async (access) => {
      calls++;
      await access.interaction.confirm("Wait");
      return { outcome: "complete" };
    };
    const first = f.runtime();
    await first.run(f.blueprint, { prompt: "legacy checkpoint" });
    await first.suspend();
    const name = readdirSync(f.directory).find((file) =>
      file.endsWith(".json"),
    );
    assert.ok(name);
    const filename = join(f.directory, name);
    const saved = JSON.parse(readFileSync(filename, "utf8"));
    saved.version = version;
    saved.schemaVersion = version;
    const original = JSON.stringify(saved);
    writeFileSync(filename, original);
    await assert.rejects(f.runtime().restore(), { code: "CHECKPOINT_INVALID" });
    assert.equal(calls, 1);
    assert.equal(readFileSync(filename, "utf8"), original);
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
  const code: ExecutableCode = async (access) => {
    await access.interaction.confirm("Transform");
    return { outcome: "complete" };
  };
  code.recover = (_saved, access) => {
    assert.deepEqual(access.state.value, { intent: "transform", value: 5 });
    return { outcome: "complete" };
  };
  f.codes.start = code;
  const first = f.runtime();
  const waiting = await first.run(f.blueprint, { prompt: "transform" });
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
  const code: ExecutableCode = async (access) => {
    await access.interaction.confirm("Wait");
    return { outcome: "complete" };
  };
  code.recover = () => ({ outcome: "complete" });
  f.codes.start = code;
  const first = f.runtime();
  const cancelled = await first.run(f.blueprint, { prompt: "cancel" });
  const retained = await first.run(f.blueprint, { prompt: "retain" });
  await first.cancelRun(cancelled.runId);
  await first.suspend();
  const second = f.runtime();
  await second.restore();
  assert.deepEqual(
    (await second.listRuns()).filter((run) => !run.historical),
    [retained],
  );
  assert.equal((await second.getRun(cancelled.runId)).historical, true);
  assert.equal(openRunCheckpointStore(f.directory).read().length, 2);
});

test("a waiting checkpoint failure is surfaced before exposing the question", async (t) => {
  const f = fixture(t);
  f.codes.start = async (access) => {
    await access.interaction.confirm("Must be durable");
    return { outcome: "complete" };
  };
  const recovery = f.recovery();
  const write = recovery.store.write;
  recovery.store.write = (input) => {
    if (checkpointSnapshotSchema.parse(input).phase === "waiting")
      throw new Error("Disk unavailable");
    write(input);
  };
  const runtime = createRuntimeHarness({ ...f.options, recovery });
  const failed = await runtime.run(f.blueprint, {
    prompt: "checkpoint failure",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError?.code, "RUN_CHECKPOINT_FAILED");
  assert.equal(failed.pendingAction, undefined);
});

test("cancellation revokes the original continuation even when its terminal checkpoint cannot be written", async (t) => {
  const f = fixture(t);
  let signal: AbortSignal | undefined;
  let finished = false;
  f.codes.start = async (access) => {
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
    if (checkpointSnapshotSchema.parse(input).phase === "terminal")
      throw new Error("Disk unavailable");
    write(input);
  };
  const runtime = createRuntimeHarness({ ...f.options, recovery });
  const waiting = await runtime.run(f.blueprint, { prompt: "cancel failure" });
  await assert.rejects(runtime.cancelRun(waiting.runId), {
    code: "RUN_CHECKPOINT_FAILED",
  });
  await setImmediate();
  assert.equal(signal?.aborted, true);
  assert.equal(finished, true);
});
