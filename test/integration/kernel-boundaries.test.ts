import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import type {
  InstalledLoomRef,
  JsonValue,
} from "../../packages/loom-sdk/dist/index.js";
import { createKernel } from "../../packages/kernel/dist/lifecycle/index.js";
import { openStorage } from "../../packages/kernel/dist/persistence/storage.js";
import type {
  LoomRuntime,
  RunBinding,
} from "../../packages/kernel/dist/lifecycle/run-contracts.js";

const ref = (id: string): InstalledLoomRef => ({
  id,
  version: "1.0.0",
  artifactDigest: "a".repeat(64),
});
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function fixture(
  t: TestContext,
  overrides: Partial<LoomRuntime> = {},
  complete: Parameters<
    typeof createKernel
  >[0]["outcomes"]["complete"] = async () => ({ quality: "not_requested" }),
) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-boundaries-"));
  const repository = await openStorage(directory);
  const binding = (loom: InstalledLoomRef): RunBinding => ({
    formatVersion: 1,
    loom,
    dependencies: [],
    entry: { kind: "code", id: "main" },
    location: { storage: "global", dataDir: join(directory, loom.id) },
    runtime: { kind: "code", version: "0.3.0", nodeMajor: 26 },
    config: {},
  });
  const executions: string[] = [];
  const runtime: LoomRuntime = {
    prepare: async (loom) => ({
      binding: binding(loom),
      normalize: (input) => input as JsonValue,
    }),
    inspect: async () => ({ kind: "missing" }),
    check: async () => {},
    normalizeResume: async (_run, _wait, input) => input as JsonValue,
    init: async (record) => ({
      async start(input) {
        executions.push(record.view.id);
        return { kind: "completed", output: input };
      },
      async resume(input) {
        executions.push(record.view.id);
        return { kind: "completed", output: input.data ?? null };
      },
      cancel: async () => {},
      release: async () => {},
    }),
  };
  const kernel = await createKernel({
    repository,
    runtime: { ...runtime, ...overrides },
    outcomes: {
      context: () => {
        throw new Error("Unexpected artifact context");
      },
      complete,
    },
    id: randomUUID,
    runId: randomUUID,
    now: () => new Date().toISOString(),
    markStopped: repository.markStopped,
    wasStopped: repository.wasStopped,
  });
  t.after(async () => {
    await kernel.close();
    await repository.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { kernel, repository, runtime, binding, executions };
}
async function succeeds(
  kernel: Awaited<ReturnType<typeof createKernel>>,
  id: string,
) {
  for (let i = 0; i < 1000; i++) {
    const run = await kernel.getRun(id);
    if (run.status === "succeeded") return;
    assert.equal(run.status, "running");
    await delay(5);
  }
  assert.fail("Execution did not finish");
}

test("package preparation does not block unrelated creation, queries or execution", {
  timeout: 10_000,
}, async (t) => {
  const entered = gate(),
    release = gate();
  t.after(release.release);
  const f = await fixture(t, {
    prepare: async (loom) => {
      if (loom.id === "slow") {
        entered.release();
        await release.promise;
      }
      return {
        binding: f.binding(loom),
        normalize: (input) => input as JsonValue,
      };
    },
  });
  const slow = f.kernel.createRun({ loom: ref("slow"), input: 1 });
  await entered.promise;
  try {
    const fast = await f.kernel.createRun({ loom: ref("fast"), input: 2 });
    assert.equal((await f.kernel.getRun(fast.id)).status, "created");
    await f.kernel.startRun(fast.id);
    await succeeds(f.kernel, fast.id);
  } finally {
    release.release();
  }
  assert.equal((await slow).status, "created");
});

test("initialization is ordered per Run while reads, other Runs and cancellation stay available", {
  timeout: 10_000,
}, async (t) => {
  const entered = gate(),
    release = gate();
  t.after(release.release);
  let initializations = 0,
    releases = 0;
  const f = await fixture(t, {
    init: async (...args) => {
      if (args[0].view.loom.id === "slow") {
        initializations++;
        entered.release();
        await release.promise;
      }
      const execution = await f.runtime.init(...args);
      return {
        ...execution,
        release: async () => {
          releases++;
        },
      };
    },
  });
  const slow = await f.kernel.createRun({ loom: ref("slow"), input: 1 });
  const first = f.kernel.startRun(slow.id),
    second = f.kernel.startRun(slow.id);
  await entered.promise;
  try {
    assert.equal((await f.kernel.getRun(slow.id)).status, "created");
    const fast = await f.kernel.createRun({ loom: ref("fast"), input: 2 });
    await f.kernel.startRun(fast.id);
    await succeeds(f.kernel, fast.id);
    assert.equal((await f.kernel.cancelRun(slow.id)).run.status, "cancelled");
  } finally {
    release.release();
  }
  assert.equal((await first).disposition, "no_change");
  assert.equal((await second).disposition, "no_change");
  assert.equal(initializations, 1);
  assert.ok(releases >= 1);
  assert.ok(!f.executions.includes(slow.id));
});

test("close drains accepted preparation and shutdown cancels the resulting created Run", {
  timeout: 10_000,
}, async (t) => {
  for (const shutdown of [false, true]) {
    const entered = gate(),
      release = gate();
    t.after(release.release);
    const f = await fixture(t, {
      prepare: async (loom) => {
        entered.release();
        await release.promise;
        return {
          binding: f.binding(loom),
          normalize: (input) => input as JsonValue,
        };
      },
    });
    const created = f.kernel.createRun({ loom: ref("slow"), input: 1 });
    await entered.promise;
    let closed = false;
    const closing = f.kernel.close(shutdown).then(() => {
      closed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(closed, false);
    release.release();
    const run = await created;
    await closing;
    assert.equal(
      (await f.repository.get(run.id))?.view.status,
      shutdown ? "cancelled" : "created",
    );
    assert.deepEqual(f.executions, []);
  }
});

test("a stop during resume normalization cannot save data or replay the waiting execution", {
  timeout: 10_000,
}, async (t) => {
  const entered = gate(),
    release = gate();
  t.after(release.release);
  let parses = 0;
  const f = await fixture(t, {
    normalizeResume: async (_record, _wait, input) => {
      parses++;
      entered.release();
      await release.promise;
      return input as JsonValue;
    },
  });
  const run = await f.kernel.createRun({ loom: ref("waiting"), input: 1 });
  const record = await f.repository.get(run.id);
  assert.ok(record);
  const wait = {
    view: {
      waitId: "wait",
      kind: "external" as const,
      origin: { componentId: "main" },
    },
    executions: [],
    definitionPath: ["main"],
    locator: {},
  };
  await f.repository.save(
    {
      ...record,
      view: { ...run, status: "waiting", waits: [wait.view] },
      waits: [wait],
      checkpoint: {
        id: "checkpoint",
        engineRef: {},
        snapshotFingerprint: "snapshot",
        waitIds: ["wait"],
        createdAt: run.createdAt,
      },
    },
    [],
  );
  const resumed = f.kernel.resumeRun({
    runId: run.id,
    waitId: "wait",
    resumeData: 2,
  });
  const rejected = assert.rejects(resumed, { code: "RUN_STATE_INVALID" });
  await entered.promise;
  try {
    assert.equal((await f.kernel.cancelRun(run.id)).run.status, "cancelled");
  } finally {
    release.release();
  }
  await rejected;
  assert.equal(parses, 1);
  assert.equal(
    (await f.repository.get(run.id))?.waits?.[0]?.accepted,
    undefined,
  );
  assert.deepEqual(f.executions, []);
});

test("outcome validation allows unrelated work and accepts cancellation before delivery", {
  timeout: 10000,
}, async (t) => {
  const entered = gate(),
    release = gate();
  const f = await fixture(t, {}, async (record) => {
    if (record.view.loom.id === "slow") {
      entered.release();
      await release.promise;
    }
    return { quality: "not_requested" };
  });
  const slow = await f.kernel.createRun({ loom: ref("slow"), input: 1 });
  await f.kernel.startRun(slow.id);
  await entered.promise;
  try {
    const fast = await f.kernel.createRun({ loom: ref("fast"), input: 2 });
    await f.kernel.startRun(fast.id);
    await succeeds(f.kernel, fast.id);
    assert.equal((await f.kernel.cancelRun(slow.id)).run.status, "stopping");
  } finally {
    release.release();
  }
  await f.kernel.close();
  assert.equal((await f.repository.get(slow.id))?.view.status, "cancelled");
  const events = await f.repository.events(slow.id);
  assert.deepEqual(
    events.filter((e) => e.type.startsWith("validation.")).map((e) => e.type),
    ["validation.started", "validation.finished"],
  );
  assert.ok(
    !events.some(
      (e) => e.type === "outcome.delivered" || e.type === "run.succeeded",
    ),
  );
});
