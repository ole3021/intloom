import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { appendFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { readLog, followLog } from "./read-log.ts";

for (const reader of [readLog, followLog]) {
  test(`${reader.name} cancellation releases a stalled output and returns the last confirmed offset`, {
    timeout: 2000,
  }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "intloom-cancel-output-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const file = join(root, "events.jsonl");
    const confirmed = '{"level":30,"event":"confirmed_write"}\n';
    await writeFile(file, `${confirmed}{"level":30,"event":"pending_write"}\n`);
    let onStarted = () => {};
    const started = new Promise<void>((resolve) => {
      onStarted = resolve;
    });
    let release: (() => void) | undefined;
    const output = new Writable({
      write(chunk, _encoding, done) {
        if (JSON.parse(String(chunk)).event === "confirmed_write") {
          done();
          return;
        }
        release = done;
        onStarted();
      },
    });
    const controller = new AbortController();
    const task = reader(file, { output, signal: controller.signal });
    await started;
    controller.abort();
    try {
      const offset = await Promise.race([
        task,
        setTimeout(500).then(() => "timed_out"),
      ]);
      assert.equal(offset, Buffer.byteLength(confirmed));
      assert.equal(output.destroyed, false);
      assert.equal(output.writableEnded, false);
      assert.equal(typeof offset, "number");
      const resumed: string[] = [];
      await readLog(file, {
        offset: offset as number,
        output: new Writable({
          write(chunk, _encoding, done) {
            resumed.push(JSON.parse(String(chunk)).event);
            done();
          },
        }),
      });
      assert.deepEqual(resumed, ["pending_write"]);
    } finally {
      release?.();
      await task;
    }
    assert.equal(output.listenerCount("error"), 0);
    assert.equal(output.listenerCount("close"), 0);
  });
}

test("cancelled follow stops at its file snapshot despite later appends", {
  timeout: 2000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-cancel-snapshot-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const initial = ["first", "second"]
    .map((event) => `${JSON.stringify({ level: 30, event })}\n`)
    .join("");
  await writeFile(file, initial);
  const controller = new AbortController();
  const events: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, done) {
      events.push(JSON.parse(String(chunk)).event);
      controller.abort();
      if (events.length < 5)
        appendFileSync(file, '{"level":30,"event":"after_cancel"}\n');
      done();
    },
  });
  const offset = await followLog(file, { output, signal: controller.signal });
  assert.deepEqual(events, ["first", "second"]);
  assert.equal(offset, Buffer.byteLength(initial));
});

test("cancelled writes still handle late output errors and release their listeners", {
  timeout: 2000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-cancel-error-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  await writeFile(file, '{"level":30,"event":"pending_write"}\n');
  let onStarted = () => {};
  const started = new Promise<void>((resolve) => {
    onStarted = resolve;
  });
  let finish: ((error: Error) => void) | undefined;
  const output = new Writable({
    write(_chunk, _encoding, done) {
      finish = done;
      onStarted();
    },
  });
  const controller = new AbortController();
  const task = followLog(file, { output, signal: controller.signal });
  await started;
  controller.abort();
  try {
    const offset = await Promise.race([
      task,
      setTimeout(500).then(() => "timed_out"),
    ]);
    assert.equal(offset, 0);
  } finally {
    finish?.(new Error("Late output failure."));
    await task.catch(() => {});
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(output.listenerCount("error"), 0);
  assert.equal(output.listenerCount("close"), 0);
});

test("reader enforces the byte limit for complete records and incomplete tails", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-record-limit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const output = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const prefix = '{"level":30,"event":"large_record","text":"';
  const suffix = '"}';
  const overhead = Buffer.byteLength(prefix + suffix);
  const limit = 64 * 1024;
  const exact = prefix + "x".repeat(limit - overhead) + suffix;
  await writeFile(file, `${exact}\n`);
  assert.equal(await readLog(file, { output }), limit + 1);
  for (const text of [
    `${prefix}${"x".repeat(limit - overhead + 1)}${suffix}\n`,
    `${prefix}${"界".repeat(Math.ceil((limit - overhead + 1) / 3))}${suffix}\n`,
    "x".repeat(limit + 1),
  ]) {
    await writeFile(file, text);
    await assert.rejects(readLog(file, { output }), /reader limit/u);
    assert.equal(output.listenerCount("error"), 0);
  }
});

test("reader rejects broken output and releases its borrowed error listener", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-broken-output-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  await writeFile(file, '{"level":30,"event":"example"}\n');
  const output = new Writable({
    write(_chunk, _encoding, done) {
      done(new Error("Output unavailable."));
    },
  });
  await assert.rejects(readLog(file, { output }), /Output unavailable/u);
  assert.equal(output.listenerCount("error"), 0);
});

test("read/follow handle byte offsets, split Unicode, partial lines, filtering and slow output", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-read-log-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const records: string[] = [];
  const output = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, done) {
      records.push(String(chunk));
      setTimeout(5).then(() => done());
    },
  });
  await writeFile(
    file,
    `${JSON.stringify({ level: 30, event: "run_created", requestId: "request", runId: "RUN-a" })}\n`,
  );
  const controller = new AbortController();
  const task = followLog(file, {
    output,
    requestId: "request",
    signal: controller.signal,
  });
  const row = Buffer.from(
    `${JSON.stringify({ level: 30, event: "step_completed", runId: "RUN-a", outcome: "完成" })}\n`,
  );
  const split = row.indexOf(Buffer.from("完成")) + 1;
  await appendFile(file, row.subarray(0, split));
  await setTimeout(100);
  assert.equal(records.length, 1);
  await appendFile(file, row.subarray(split));
  await appendFile(
    file,
    `${JSON.stringify({ level: 30, runId: "RUN-b", event: "other_run" })}\n`,
  );
  await appendFile(
    file,
    `${JSON.stringify({ level: 20, runId: "RUN-a", event: "debug_only" })}\n`,
  );
  await appendFile(file, "partial");
  controller.abort();
  const offset = await task;
  assert.equal(records.length, 2);
  assert.equal(JSON.parse(records[1] ?? "null").outcome, "完成");
  await appendFile(file, "\n");
  assert.ok((await readLog(file, { output, offset })) > offset);
  assert.equal(output.destroyed, false);
});
