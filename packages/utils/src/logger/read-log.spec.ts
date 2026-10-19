import { deferred } from "../../test/deferred.ts";
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

test("read offsets stop before partial Unicode records and resume without loss or duplication", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-read-offset-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const records: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, done) {
      records.push(String(chunk));
      done();
    },
  });
  const first = '{"level":30,"event":"started"}\n';
  const next = Buffer.from(
    '{"level":30,"event":"completed","outcome":"完成"}\n',
  );
  const split = next.indexOf(Buffer.from("完成")) + 1;
  await writeFile(
    file,
    Buffer.concat([Buffer.from(first), next.subarray(0, split)]),
  );
  const offset = await readLog(file, { output });
  assert.equal(offset, Buffer.byteLength(first));
  assert.deepEqual(records, [first]);

  await appendFile(file, next.subarray(split));
  await appendFile(file, "partial");
  const completed = await readLog(file, { output, offset });
  assert.equal(completed, Buffer.byteLength(first) + next.length);
  assert.deepEqual(records, [first, next.toString("utf8")]);
  await appendFile(file, "\n");
  assert.equal(
    await readLog(file, { output, offset: completed }),
    completed + 8,
  );
  assert.equal(records.length, 2);
  assert.equal(output.destroyed, false);
});

test("request filtering follows associated Runs and applies the level threshold", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-read-filter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const input = [
    { level: 30, event: "created", requestId: "request", runId: "RUN-a" },
    { level: 30, event: "completed", runId: "RUN-a" },
    { level: 30, event: "other_run", runId: "RUN-b" },
    { level: 20, event: "debug_only", runId: "RUN-a" },
  ]
    .map((record) => `${JSON.stringify(record)}\n`)
    .join("");
  await writeFile(file, input);
  const events: string[] = [];
  const output = new Writable({
    write(chunk, _encoding, done) {
      events.push(JSON.parse(String(chunk)).event);
      done();
    },
  });
  assert.equal(
    await readLog(file, { output, requestId: "request" }),
    Buffer.byteLength(input),
  );
  assert.deepEqual(events, ["created", "completed"]);
});

test("follow waits for borrowed output before delivering appended records", {
  timeout: 2000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-follow-output-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  const first = '{"level":30,"event":"first"}\n';
  const second = '{"level":30,"event":"second"}\n';
  await writeFile(file, first);
  const started = deferred();
  const controller = new AbortController();
  let release: (() => void) | undefined;
  const events: string[] = [];
  const output = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, done) {
      events.push(JSON.parse(String(chunk)).event);
      if (events.length === 1) {
        release = done;
        started.resolve();
      } else {
        controller.abort();
        done();
      }
    },
  });
  const task = followLog(file, { output, signal: controller.signal });
  t.after(() => {
    controller.abort();
    release?.();
  });
  await started.promise;
  await appendFile(file, second);
  assert.deepEqual(events, ["first"]);
  release?.();
  release = undefined;
  assert.equal(await task, Buffer.byteLength(first + second));
  assert.deepEqual(events, ["first", "second"]);
  assert.equal(output.destroyed, false);
  assert.equal(output.listenerCount("error"), 0);
  assert.equal(output.listenerCount("close"), 0);
});
