import { cliArgs } from "../fixtures/cli.mjs";
import { writeFixturePackage } from "./fixture-package.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createKernel } from "../../packages/kernel/dist/lifecycle/index.js";
import { openRunRepository } from "../../packages/kernel/dist/persistence/runs.js";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { serve, type Kernel } from "../../packages/kernel/dist/index.js";
import { createIntegrity } from "../../packages/loom-sdk/dist/package-format/index.js";
import { stableJson } from "../../packages/loom-sdk/dist/schema/json.js";
import type { RunView } from "../../packages/loom-sdk/dist/index.js";
import { startLocalService } from "../../apps/cli/dist/local-service.js";
import { requestService } from "../../apps/cli/dist/service/client.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = join(root, "apps/cli/dist/bin.js");
const exec = promisify(execFile);
const code = (expected: string) => (error: unknown) =>
  (error as { code?: string }).code === expected;
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-lifecycle-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const author = join(directory, "author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(
    join(author, "loom.ts"),
    await readFile(
      join(root, "test/fixtures/lifecycle-code.ts.fixture"),
      "utf8",
    ),
  );
  await writeFile(join(author, "guide.txt"), "immutable guide");
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(directory, "compiled"),
    target: "node22",
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  return { directory, compiled, dataDir: join(directory, "data") };
}
async function settled(host: Kernel, id: string) {
  for (let i = 0; i < 150; i++) {
    const run = await host.getRun(id);
    if (
      ["succeeded", "failed", "cancelled", "interrupted"].includes(run.status)
    )
      return run;
    await delay(10);
  }
  throw new Error("Run did not settle.");
}
async function started(t: TestContext, dataDir: string) {
  const child = spawn(
    process.execPath,
    [...cliArgs(binary, dataDir), "startup", "--plain"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(async () => {
    await requestService(dataDir, "serviceShutdown").catch(() => undefined);
    child.kill("SIGKILL");
  });
  let errors = "";
  child.stderr.on("data", (value) => {
    errors += value;
  });
  const ready = await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error(errors || "Host exited before ready.");
    }),
  ]);
  assert.equal(
    JSON.parse(String(ready[0])).data?.status,
    "ready",
    String(ready[0]),
  );
  return child;
}

test("SDK creates without execution, normalizes once, explicitly runs installed Code and preserves records", async (t) => {
  const { directory, compiled, dataDir } = await fixture(t);
  const logs: { runId: string; message: unknown }[] = [];
  const host = await serve({
    dataDir,
  });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  await rm(join(directory, "author"), { recursive: true });
  await assert.rejects(
    host.createRun({ loom: ref, input: { value: "bad" } }),
    code("INPUT_INVALID"),
  );
  const run = await host.createRun({ loom: ref, input: {} });
  assert.equal(run.status, "created");
  assert.equal(host.activeRunCount, 0);
  assert.equal((await host.getRunResult(run.id)).output, undefined);
  assert.deepEqual(
    (await host.listRunEvents({ runId: run.id })).items.map(
      (event) => event.type,
    ),
    ["run.created"],
  );
  const controls = await Promise.all([
    host.startRun(run.id),
    host.startRun(run.id),
  ]);
  assert.deepEqual(
    controls.map((result) => result.disposition),
    ["accepted", "no_change"],
  );
  const result = await settled(host, run.id);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.output, {
    value: 7,
    calls: 1,
    normalizations: 2,
    resource: "immutable guide",
    runId: run.id,
  });
  const final = await host.getRunResult(run.id);
  logs.push(
    ...(await host.listRunEvents({ runId: run.id, limit: 100 })).items
      .filter((event) => event.type === "log")
      .map((event) => ({ runId: event.runId, message: event.details.message })),
  );
  assert.deepEqual(logs, [
    { runId: run.id, message: "entered" },
    { runId: run.id, message: "leaving" },
  ]);
  assert.equal(final.quality, "not_requested");
  assert.deepEqual(final.output, result.output);
  const first = await host.listRunEvents({ runId: run.id, limit: 2 });
  assert.equal(first.items.length, 2);
  assert.equal(first.nextAfter, 2);
  const later = await host.listRunEvents({
    runId: run.id,
    after: first.nextAfter,
  });
  assert.deepEqual(
    later.items.map((event) => event.seq),
    Array.from({ length: later.items.length }, (_, index) => index + 3),
  );
  assert.equal(later.items[0]?.origin?.componentId, "execute");
  assert.equal((await host.cancelRun(run.id)).disposition, "no_change");
  await host.close();
  const reopened = await serve({ dataDir });
  t.after(() => reopened.close());
  assert.deepEqual((await reopened.getRun(run.id)).output, result.output);
  assert.equal((await reopened.startRun(run.id)).disposition, "no_change");
  await assert.rejects(stat(join(run.location.dataDir, "mastra.db")), {
    code: "ENOENT",
  });
});

test("cancellation waits for cooperative cleanup; failures and non-JSON results stay distinct", async (t) => {
  const { compiled, dataDir } = await fixture(t);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const created = await host.createRun({ loom: ref, input: {} });
  assert.equal((await host.cancelRun(created.id)).run.status, "cancelled");
  assert.equal((await host.startRun(created.id)).disposition, "no_change");
  const run = await host.createRun({ loom: ref, input: { mode: "cancel" } });
  const independent = await host.createRun({
    loom: ref,
    input: { mode: "slow" },
  });
  await host.startRun(run.id);
  await host.startRun(independent.id);
  const cancellation = await host.cancelRun(run.id, "stop");
  assert.equal(cancellation.run.status, "stopping");
  assert.equal((await host.getRun(run.id)).status, "stopping");
  assert.equal((await host.cancelRun(run.id)).disposition, "no_change");
  assert.equal((await settled(host, run.id)).status, "cancelled");
  assert.equal((await host.getRunResult(run.id)).output, undefined);
  assert.equal((await settled(host, independent.id)).status, "succeeded");
  for (const [mode, expected] of [
    ["fail", "EXECUTION_FAILED"],
    ["invalid", "STORAGE_FAILED"],
  ] as const) {
    const run = await host.createRun({ loom: ref, input: { mode } });
    await host.startRun(run.id);
    const view = await settled(host, run.id);
    assert.equal(view.status, "failed");
    assert.equal(view.error?.code, expected);
    if (mode === "fail") {
      assert.match(view.error?.message ?? "", /"execute"/);
      assert.match(
        JSON.stringify(view.error?.details),
        /Request failed: token=\[redacted\]/,
      );
      assert.match(JSON.stringify(view.error?.details), /stack/);
    }
    assert.ok(!JSON.stringify(view).includes("SECRET"));
    assert.equal((await host.cancelRun(run.id)).run.status, "failed");
  }
});

test("close drains active work, keeps created work inert and enforces query cursors", async (t) => {
  const { directory, compiled, dataDir } = await fixture(t);
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const slow = await host.createRun({ loom: ref, input: { mode: "slow" } });
  const inert = await host.createRun({ loom: ref, input: {} });
  const page = await host.listRuns({ limit: 1 });
  assert.ok(page.nextCursor);
  assert.equal(
    (await host.listRuns({ cursor: page.nextCursor, limit: 1 })).items.length,
    1,
  );
  await assert.rejects(
    host.listRuns({ status: "created", cursor: page.nextCursor }),
    code("INVALID_ARGUMENT"),
  );
  await writeFile(join(directory, "author/guide.txt"), "new artifact resource");
  const newer = await compileLoom({
    entryFile: join(directory, "author/loom.ts"),
    outDir: compiled.artifactDir,
    target: "node22",
  });
  assert.ok(newer.ok, JSON.stringify(newer));
  await host.installLoom({ source: newer.artifactDir });
  assert.equal(
    (await host.getLoom({ id: ref.id, version: ref.version })).ref
      .artifactDigest,
    newer.artifactDigest,
  );
  assert.deepEqual((await host.getLoom(ref)).ref, ref);
  await host.startRun(slow.id);
  const closing = host.close();
  await assert.rejects(
    host.createRun({ loom: ref, input: {} }),
    code("SERVICE_BUSY"),
  );
  await closing;
  const reopened = await serve({ dataDir });
  t.after(() => reopened.close());
  assert.equal((await reopened.getRun(slow.id)).status, "succeeded");
  assert.equal((await reopened.getRun(inert.id)).status, "created");
  await reopened.startRun(inert.id);
  const result = await settled(reopened, inert.id);
  assert.equal((result.output as { normalizations: number }).normalizations, 0);
  assert.equal(
    (result.output as { resource: string }).resource,
    "immutable guide",
  );
});

test("loader rejects a manifest/module mismatch without executing the Code callback", async (t) => {
  const { compiled, dataDir } = await fixture(t);
  const modulePath = join(compiled.artifactDir, "runtime.mjs");
  const bytes = (await readFile(modulePath, "utf8")).replace(
    'description:"Code execution evidence"',
    'description:"changed description"',
  );
  const files = new Map<string, Uint8Array>([
    [
      "package.json",
      await readFile(join(compiled.artifactDir, "package.json")),
    ],
    ["runtime.mjs", Buffer.from(bytes)],
    ["loom.json", await readFile(join(compiled.artifactDir, "loom.json"))],
    [
      "resources/guide/guide.txt",
      await readFile(join(compiled.artifactDir, "resources/guide/guide.txt")),
    ],
  ]);
  await writeFile(modulePath, bytes);
  await writeFile(
    join(compiled.artifactDir, "integrity.json"),
    stableJson(await createIntegrity(files)),
  );
  const host = await serve({ dataDir });
  t.after(() => host.close());
  const ref = await host.installLoom({ source: compiled.artifactDir });
  await assert.rejects(
    host.createRun({ loom: ref, input: {} }),
    code("PACKAGE_INCOMPATIBLE"),
  );
  assert.equal((await host.listRuns()).items.length, 0);
});

test("failed final transaction cannot report succeeded and restart never replays it", async (t) => {
  const { compiled, dataDir } = await fixture(t);
  const host = await serve({ dataDir });
  const ref = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom: ref, input: {} });
  const { createClient } = createRequire(
    join(root, "packages/kernel/package.json"),
  )(
    "@libsql/client",
  ) as typeof import("../../packages/kernel/node_modules/@libsql/client/lib-esm/node.js");
  assert.ok(run.location);
  const database = createClient({
    url: `file:${join(run.location.dataDir, "kernel.db")}`,
  });
  await database.execute(
    "CREATE TRIGGER reject_success BEFORE UPDATE ON runs WHEN json_extract(NEW.record, '$.view.status') = 'succeeded' BEGIN SELECT RAISE(ABORT, 'injected final write failure'); END",
  );
  await host.startRun(run.id);
  await host.close();
  await database.execute("DROP TRIGGER reject_success");
  database.close();
  const reopened = await serve({ dataDir });
  t.after(() => reopened.close());
  assert.equal((await reopened.getRun(run.id)).status, "interrupted");
  assert.equal((await reopened.startRun(run.id)).disposition, "no_change");
});

test("simultaneous clients both connect to the first service owner", async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "intloom-simultaneous-"));
  t.after(async () => {
    await requestService(dataDir, "serviceShutdown").catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true });
  });
  const [first, second] = await Promise.all([
    startLocalService(dataDir, 0),
    startLocalService(dataDir, 0),
  ]);
  assert.equal(second.endpoint, first.endpoint);
});
test("CLI clients share one authenticated host and disconnect without cancelling accepted Runs", async (t) => {
  const { directory, dataDir } = await fixture(t);
  const build = await exec(process.execPath, [
    ...cliArgs(binary, dataDir),
    "dev",
    "build",
    "--project",
    join(directory, "author"),
    "--plain",
  ]);
  const archive = JSON.parse(build.stdout).data.archiveFile;
  await assert.rejects(
    requestService(dataDir, "serviceStatus"),
    code("SERVICE_NOT_RUNNING"),
  );
  const child = await started(t, dataDir);
  const runCli = async (...args: string[]) => {
    const result = await exec(process.execPath, [
      ...cliArgs(binary, dataDir),
      ...args,
      "--plain",
    ]);
    return JSON.parse(result.stdout) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
  };
  const installed = await runCli("install", archive);
  const digest = String(installed.data.artifactDigest);
  const success = await runCli("run", digest, "--input", "{}");
  assert.equal(success.data.status, "succeeded");
  const descriptor = JSON.parse(
    await readFile(join(dataDir, "service.json"), "utf8"),
  ) as { endpoint: string; token: string };
  const invalid = createConnection(descriptor.endpoint);
  await once(invalid, "connect");
  invalid.write(
    `${JSON.stringify({ formatVersion: 1, id: "bad", token: "wrong", method: "serviceShutdown", params: [] })}\n`,
  );
  const [reply] = await once(invalid, "data");
  assert.equal(JSON.parse(String(reply)).error.code, "SERVICE_ACCESS_DENIED");
  invalid.destroy();
  const made = await runCli(
    "run",
    "create",
    digest,
    "--input",
    '{"mode":"slow"}',
  );
  const runId = String(made.data.id);
  const observer = spawn(
    process.execPath,
    [...cliArgs(binary, dataDir), "status", runId, "--watch", "--plain"],
    { stdio: "ignore" },
  );
  await runCli("run", "start", runId);
  const observerExit = once(observer, "exit");
  observer.kill("SIGINT");
  await observerExit;
  for (
    let i = 0;
    i < 100 &&
    ((await requestService(dataDir, "getRun", [runId])) as RunView).status ===
      "running";
    i++
  )
    await delay(10);
  assert.equal(
    ((await runCli("status", runId)).data.run as RunView).status,
    "succeeded",
  );
  const input = join(directory, "input.json");
  await writeFile(input, '{"value":11}');
  assert.equal(
    (
      (await runCli("run", digest, "--input", `@${input}`)).data.output as {
        value: number;
      }
    ).value,
    11,
  );
  const cancelled = await runCli("run", "create", digest, "--input", "{}");
  assert.equal(
    (
      (await runCli("run", "stop", String(cancelled.data.id))).data
        .run as RunView
    ).status,
    "cancelled",
  );
  const exit = once(child, "exit");
  await requestService(dataDir, "serviceShutdown");
  assert.deepEqual(await exit, [0, null]);
});

test("killed host reconciles running/stopping as interrupted and preserves unstarted Runs", async (t) => {
  const { compiled, dataDir } = await fixture(t);
  const child = await started(t, dataDir);
  const ref = await requestService(dataDir, "installLoom", [
    { source: compiled.artifactDir },
  ]);
  const running = (await requestService(dataDir, "createRun", [
    { loom: ref, input: { mode: "cancel" } },
  ])) as RunView;
  const created = (await requestService(dataDir, "createRun", [
    { loom: ref, input: {} },
  ])) as RunView;
  await requestService(dataDir, "startRun", [running.id]);
  await requestService(dataDir, "cancelRun", [running.id]);
  const exit = once(child, "exit");
  process.kill(
    JSON.parse(await readFile(join(dataDir, "service.json"), "utf8")).pid,
    "SIGKILL",
  );
  await exit;
  const next = await started(t, dataDir);
  assert.equal(
    ((await requestService(dataDir, "getRun", [running.id])) as RunView).status,
    "interrupted",
  );
  assert.equal(
    ((await requestService(dataDir, "getRun", [created.id])) as RunView).status,
    "created",
  );
  const events = await requestService(dataDir, "listRunEvents", [
    { runId: running.id },
  ]);
  assert.equal(
    events.items.filter((event) => event.type === "run.started").length,
    1,
  );
  const done = once(next, "exit");
  await requestService(dataDir, "serviceShutdown");
  await done;
});

test("short Run IDs retain old UUID records and retry collisions during serialized creation", async (t) => {
  const { compiled, dataDir } = await fixture(t);
  const host = await serve({ dataDir });
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const first = await host.createRun({ loom, input: {} });
  assert.match(first.id, /^R[A-Z0-9]{5}$/);
  await host.close();
  assert.ok(first.location);
  const repository = await openRunRepository(
    join(first.location.dataDir, "kernel.db"),
  );
  t.after(() => repository.close());
  const saved = await repository.get(first.id);
  assert.ok(saved);
  const legacyId = randomUUID();
  await repository.save(
    { ...saved, view: { ...saved.view, id: legacyId } },
    [],
  );
  const candidates = [first.id, "R11111", "R11111", "R22222"];
  const unused = (): never => {
    throw new Error("Creation must not execute a Loom");
  };
  const kernel = await createKernel({
    markStopped: async () => {},
    wasStopped: () => false,
    repository,
    runtime: {
      prepare: async () => ({ binding: saved.binding, normalize: () => ({}) }),
      inspect: unused,
      check: unused,
      normalizeResume: unused,
      init: unused,
    },
    outcomes: { context: unused, complete: unused },
    id: randomUUID,
    runId: () => {
      const value = candidates.shift();
      assert.ok(value);
      return value;
    },
    now: () => new Date().toISOString(),
  });
  const created = await Promise.all([
    kernel.createRun({ loom, input: {} }),
    kernel.createRun({ loom, input: {} }),
  ]);
  assert.deepEqual(
    created.map((run) => run.id),
    ["R11111", "R22222"],
  );
  assert.deepEqual(await repository.get(first.id), saved);
  assert.equal((await kernel.getRun(legacyId)).id, legacyId);
});
