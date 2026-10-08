import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mkdtemp, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout } from "node:timers/promises";
import { openLog } from "./open-log.ts";
import { getLogger, withLogger } from "./context.ts";
import { LoomError } from "../error/loom-error.ts";
import { retainLogs } from "./retention.ts";

async function directory(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "intloom-log-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function records(path: string) {
  return (await readFile(path, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("flat exclusive files, minimal records, immutable bindings and idempotent close", async (t) => {
  const root = await directory(t);
  const handles = await Promise.all(
    Array.from({ length: 6 }, () => openLog({ directory: root })),
  );
  assert.equal(new Set(handles.map((item) => item.filePath)).size, 6);
  const handle = handles[0];
  assert.ok(handle);
  assert.match(basename(handle.filePath), /^LOG-\d{8}T\d{9}Z\.jsonl$/u);
  const log = handle.logger.child({ runId: "RUN-first" });
  log.child({ runId: "RUN-other", executionId: 1 }).info("step_completed", {
    runId: "RUN-forged",
    level: 60,
    time: "forged",
    event: "forged",
    durationMs: 3,
  });
  assert.throws(() => log.info("invalid event"), TypeError);
  await Promise.all(handles.map((item) => item.close()));
  await handle.close();
  assert.throws(() => log.assertHealthy(), { code: "LOG_CLOSED" });
  log.info("ignored_after_close");
  const rows = await records(handle.filePath);
  assert.deepEqual(
    rows.map((row) => row.event),
    ["log_opened", "step_completed", "log_closed"],
  );
  assert.equal(rows[1].runId, "RUN-first");
  assert.equal(rows[1].level, 30);
  assert.equal(rows[1].executionId, 1);
  assert.equal(rows[1].msg, undefined);
  assert.equal(rows[1].pid, undefined);
  assert.equal((await readdir(root)).length, 6);
  if (process.platform !== "win32")
    assert.equal((await stat(handle.filePath)).mode & 0o077, 0);
});

test("safe errors, recursive redaction, serializer projection and bounded data", async (t) => {
  const handle = await openLog({
    directory: await directory(t),
    pino: {
      serializers: {
        result: (value) => ({ count: value.length }),
        dropped: () => undefined,
        err: () => ({ message: "LEAK" }),
      },
      redact: ["metadata.privateValue"],
    },
  });
  let getters = 0;
  const circular: Record<string, unknown> = {
    secret: "SECRET",
    api_key: "KEY",
  };
  circular.circular = circular;
  Object.defineProperty(circular, "getter", {
    enumerable: true,
    get() {
      getters++;
      return "GETTER";
    },
  });
  const error = new LoomError("LLM_REQUEST_FAILED", "RAW_SECRET", {
    cause: new Error("SDK_SECRET"),
  });
  handle.logger.error("request_failed", {
    err: error,
    headers: { authorization: "Bearer TOKEN" },
    intent: "PRIVATE_INTENT",
    result: ["PRIVATE_RESULT"],
    dropped: "PRIVATE_DROP",
    circular,
    metadata: { privateValue: "PRIVATE_VALUE" },
    text: "Bearer abc https://user:password@host/?key=secret",
    huge: Array.from({ length: 30 }, () => "x".repeat(50_000)),
  });
  await handle.close();
  const text = await readFile(handle.filePath, "utf8");
  for (const secret of [
    "RAW_SECRET",
    "SDK_SECRET",
    "PRIVATE_INTENT",
    "PRIVATE_RESULT",
    "PRIVATE_DROP",
    "PRIVATE_VALUE",
    "GETTER",
    "LEAK",
    "Bearer abc",
  ])
    assert.ok(!text.includes(secret), secret);
  assert.equal(getters, 0);
  const row = (await records(handle.filePath))[1];
  assert.equal(row.err.code, "LLM_REQUEST_FAILED");
  assert.deepEqual(row.result, { count: 1 });
  assert.equal(row.truncated, true);
  assert.ok(Buffer.byteLength(text) < 20_000);
});

test("asynchronous calls keep independent Run contexts", async (t) => {
  const handle = await openLog({ directory: await directory(t) });
  await Promise.all(
    ["RUN-a", "RUN-b"].map((runId, index) =>
      withLogger(handle.logger.child({ runId }), async () => {
        getLogger().info("step_started");
        await setTimeout(index ? 1 : 5);
        getLogger().info("step_completed", { outcome: runId });
      }),
    ),
  );
  await handle.close();
  const rows = (await records(handle.filePath)).filter(
    (row) => row.event === "step_completed",
  );
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal(row.runId, row.outcome);
  assert.equal(getLogger().isLevelEnabled("info"), false);
});

test("a write failure notifies the owner once and close rejects without retrying", async (t) => {
  const failures: Error[] = [];
  const handle = await openLog({
    directory: await directory(t),
    onError: (error) => failures.push(error),
  });
  t.mock.method(fs, "writeSync", () => {
    throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
  });
  syncBuiltinESMExports();
  try {
    handle.logger.info("first_write");
    handle.logger.info("second_write");
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(failures.length, 1);
  assert.throws(
    () => handle.logger.child({ runId: "RUN-child" }).assertHealthy(),
    { code: "LOG_WRITE_FAILED" },
  );
  assert.equal(handle.logger.isLevelEnabled("info"), false);
  await assert.rejects(handle.close(), { code: "LOG_WRITE_FAILED" });
});

for (const operation of ["fsyncSync", "closeSync", "chmodSync"] as const) {
  test(`${operation} failure rejects close, notifies once and never makes the file eligible for retention`, async (t) => {
    const root = await directory(t);
    const failures: Error[] = [];
    const handle = await openLog({
      directory: root,
      onError: (error) => failures.push(error),
    });
    const originalClose = fs.closeSync;
    t.mock.method(fs, operation, (...args: unknown[]) => {
      if (operation === "closeSync") originalClose(args[0] as number);
      throw new Error("Simulated close failure.");
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(handle.close(), { code: "LOG_WRITE_FAILED" });
      await assert.rejects(handle.close(), { code: "LOG_WRITE_FAILED" });
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.equal(failures.length, 1);
    assert.notEqual((await stat(handle.filePath)).mode & 0o222, 0);
    await utimes(handle.filePath, 0, 0);
    await retainLogs(root);
    assert.equal((await readdir(root)).length, 1);
  });
}
