import assert from "node:assert/strict";
import { watch } from "node:fs";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ExecutionCancelledError,
  ExecutionRejectedError,
  TextEncodingError,
  withTempDir,
} from "@intloom/loom-sdk";
import { createToolScope } from "../dist/index.js";

async function scope(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-tools-"));
  const tools = createToolScope({ tempDir: directory, ...options });
  t.after(async () => {
    await tools.close();
    await rm(directory, { recursive: true, force: true });
  });
  return tools;
}

test("file tools round-trip strict UTF-8 and preserve existing data on invalid writes", async (t) => {
  const tools = await scope(t);
  const path = join(tools.tempDir, "text.txt");
  const content = "\uFEFF陈🌍\r\nunchanged\n";
  await tools.fs.write({ path, content });
  assert.equal(await tools.fs.read({ path }), content);
  assert.deepEqual(await readFile(path), Buffer.from(content));
  await assert.rejects(
    tools.fs.write({ path, content: "invalid\ud800" }),
    TextEncodingError,
  );
  assert.equal(await tools.fs.read({ path }), content);
  await writeFile(path, Buffer.from([0xc3, 0x28]));
  await assert.rejects(tools.fs.read({ path }), TextEncodingError);
  assert.deepEqual(await readdir(tools.tempDir), ["text.txt"]);
});

test("directory tools distinguish missing paths, links and explicit recursive deletion", async (t) => {
  const tools = await scope(t);
  const directory = join(tools.tempDir, "folder");
  await tools.fs.mkdir({ path: directory });
  await tools.fs.write({ path: join(directory, "file"), content: "data" });
  const link = join(tools.tempDir, "link");
  await symlink(directory, link, "junction");
  assert.equal((await tools.fs.stat({ path: link })).type, "symlink");
  assert.equal(
    (await tools.fs.stat({ path: link, followSymlinks: true })).type,
    "directory",
  );
  assert.deepEqual(await tools.fs.list({ path: directory }), [
    { name: "file", type: "file" },
  ]);
  assert.equal(await tools.fs.stat({ path: join(directory, "missing") }), null);
  await assert.rejects(tools.fs.remove({ path: directory }));
  await tools.fs.remove({ path: directory, recursive: true });
  await tools.fs.remove({ path: directory });
});

test("process receipts distinguish nonzero exit, failed launch, timeout and signal", async (t) => {
  const tools = await scope(t);
  const run = (code, extra = {}) =>
    tools.process.run({
      command: process.execPath,
      args: ["-e", code],
      cwd: tools.tempDir,
      ...extra,
    });
  const receipt = await run(
    "process.stdout.write(process.env.LOOM_TEST); process.stderr.write('evidence'); process.exitCode=7",
    { env: { LOOM_TEST: "陈🌍" } },
  );
  assert.equal(receipt.status, "exited");
  assert.equal(receipt.exitCode, 7);
  assert.equal(receipt.stdout, "陈🌍");
  assert.equal(receipt.stderr, "evidence");
  assert.ok(receipt.startedAt && receipt.durationMs >= 0);
  const missing = await tools.process.run({
    command: join(tools.tempDir, "missing"),
    args: [],
    cwd: tools.tempDir,
  });
  assert.equal(missing.status, "launch-failed");
  assert.equal(missing.exitCode, null);
  assert.ok(missing.error);
  const timeout = await run("setInterval(()=>{},1000)", { timeoutMs: 100 });
  assert.equal(timeout.status, "timed-out");
  const signaled = await run("process.kill(process.pid, 'SIGTERM')");
  assert.equal(signaled.status, "signaled");
  assert.equal(signaled.signal, "SIGTERM");
});

test("process output is bounded without replacement characters and validates bytes beyond the cap", async (t) => {
  const tools = await scope(t);
  const run = (code, maxOutputBytes = 5) =>
    tools.process.run({
      command: process.execPath,
      args: ["-e", code],
      cwd: tools.tempDir,
      maxOutputBytes,
    });
  const result = await run("process.stdout.write('🌍🌍tail')");
  assert.equal(result.stdout, "🌍");
  assert.equal(result.truncated, true);
  await assert.rejects(
    run("process.stdout.write(Buffer.from([65,65,65,65,65,255]))"),
    TextEncodingError,
  );
  await assert.rejects(
    run("process.stdout.write(Buffer.from([0xe2,0x82]))"),
    TextEncodingError,
  );
  const split = await run(
    "process.stdout.write(Buffer.from([0xf0,0x9f]));setTimeout(()=>process.stdout.write(Buffer.from([0x8c,0x8d])),20)",
  );
  assert.equal(split.stdout, "🌍");
  assert.equal(split.truncated, false);
});

test("cancellation stops a running process before temporary cleanup and blocks new tools", {
  timeout: 10_000,
}, async (t) => {
  const tools = await scope(t);
  let temporary;
  const running = withTempDir(tools, async (directory) => {
    temporary = directory;
    const watcher = watch(directory, (_event, filename) => {
      if (String(filename) === "ready") {
        watcher.close();
        tools.cancel("User stopped validation");
      }
    });
    t.after(() => watcher.close());
    return tools.process.run({
      command: process.execPath,
      args: [
        "-e",
        "process.on('SIGTERM',()=>{});require('node:fs').writeFileSync('ready','yes');setInterval(()=>{},1000)",
      ],
      cwd: directory,
    });
  });
  await assert.rejects(running, {
    name: "ExecutionCancelledError",
    message: "User stopped validation",
  });
  assert.deepEqual(await readdir(tools.tempDir), []);
  await assert.rejects(
    tools.fs.read({ path: temporary }),
    ExecutionCancelledError,
  );
  await assert.rejects(
    tools.process.run({
      command: process.execPath,
      args: [],
      cwd: tools.tempDir,
    }),
    ExecutionCancelledError,
  );
  assert.deepEqual(await tools.close(), []);
});

test("cleanup stops managed process descendants and removes abandoned temporary directories", {
  timeout: 10_000,
}, async (t) => {
  const tools = await scope(t);
  const directory = await tools.fs.mkdtemp({ directory: tools.tempDir });
  let descendant;
  const ready = new Promise((resolve) => {
    const watcher = watch(directory, async (_event, filename) => {
      if (String(filename) !== "ready") return;
      watcher.close();
      descendant = Number(await readFile(join(directory, "ready"), "utf8"));
      resolve();
    });
    t.after(() => watcher.close());
  });
  const running = tools.process.run({
    command: process.execPath,
    args: [
      "-e",
      "require('node:child_process').spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});require('node:fs').writeFileSync('ready',String(process.pid));setInterval(()=>{},1000)\"],{stdio:'inherit'});setInterval(()=>{},1000)",
    ],
    cwd: directory,
  });
  const rejected = assert.rejects(running, ExecutionCancelledError);
  await ready;
  assert.deepEqual(await tools.close(), []);
  await rejected;
  assert.deepEqual(await readdir(tools.tempDir), []);
  assert.throws(() => process.kill(descendant, 0), { code: "ESRCH" });
});

test("temporary cleanup preserves the primary error and records removal failures", {
  skip: process.getuid?.() === 0,
}, async (t) => {
  const tools = await scope(t);
  const primary = new Error("business failure");
  t.after(() => chmod(tools.tempDir, 0o700).catch(() => {}));
  await assert.rejects(
    withTempDir(tools, async () => {
      await chmod(tools.tempDir, 0o500);
      throw primary;
    }),
    (error) => error === primary,
  );
  assert.equal(tools.cleanupFailures.length, 1);
  await chmod(tools.tempDir, 0o700);
  await tools.close();
  assert.deepEqual(await readdir(tools.tempDir), []);
});

test("rejection is catchable by a parent and remains separate from available outputs", async (t) => {
  const tools = await scope(t);
  await tools.fs.write({
    path: join(tools.tempDir, "evidence.json"),
    content: '{"passed":false}',
  });
  const child = async () => tools.reject({ reason: "Evidence did not pass" });
  await assert.rejects(child(), ExecutionRejectedError);
  assert.equal(
    await tools.fs.read({ path: join(tools.tempDir, "evidence.json") }),
    '{"passed":false}',
  );
  assert.equal(tools.signal.aborted, false);
  const parent = async () => {
    try {
      await child();
    } catch (error) {
      if (error instanceof ExecutionRejectedError) return "handled";
      throw error;
    }
  };
  assert.equal(await parent(), "handled");
});

test("interaction retries and deferrals retain identity and draft without resolving ask", async (t) => {
  const tools = await scope(t);
  let preceding = 0;
  let following = 0;
  const business = async () => {
    preceding++;
    const answer = await tools.user.ask({
      question: "Your name?",
      context: "At least two characters",
      mode: "text",
      schema: { type: "string", minLength: 2 },
      allowDefer: true,
    });
    following++;
    return answer;
  };
  const waiting = business();
  const id = tools.interactions.list()[0].id;
  const invalid = tools.interactions.submit(id, {
    status: "answered",
    value: "a",
  });
  assert.equal(invalid.status, "pending");
  assert.ok(invalid.interaction.issues.length);
  const deferred = tools.interactions.submit(id, { status: "deferred" });
  assert.equal(deferred.interaction.status, "deferred");
  assert.equal(deferred.interaction.draft, "a");
  await Promise.resolve();
  assert.equal(preceding, 1);
  assert.equal(following, 0);
  assert.equal(tools.interactions.list()[0].id, id);
  assert.deepEqual(
    tools.interactions.submit(id, { status: "answered", value: "Ada" }),
    { status: "accepted" },
  );
  assert.deepEqual(await waiting, { status: "answered", value: "Ada" });
  assert.equal(following, 1);
  assert.deepEqual(tools.interactions.list(), []);
});

test("choices, custom feedback, skip, false confirmation and cancellation have distinct semantics", async (t) => {
  const tools = await scope(t);
  const options = [{ value: "yes", label: "Yes" }];
  const single = tools.user.ask({
    question: "Choose",
    mode: "single",
    options,
  });
  let id = tools.interactions.list()[0].id;
  for (const value of [
    { kind: "option", value: "unknown" },
    { kind: "custom", text: "other" },
  ])
    assert.equal(
      tools.interactions.submit(id, { status: "answered", value }).status,
      "pending",
    );
  assert.throws(() => tools.interactions.submit(id, { status: "skipped" }));
  assert.throws(() => tools.interactions.submit(id, { status: "deferred" }));
  tools.interactions.submit(id, {
    status: "answered",
    value: { kind: "option", value: "yes" },
  });
  assert.deepEqual((await single).value, { kind: "option", value: "yes" });
  const multiple = tools.user.ask({
    question: "Choose",
    mode: "multiple",
    options,
    allowCustom: true,
  });
  id = tools.interactions.list()[0].id;
  const values = [
    { kind: "option", value: "yes" },
    { kind: "custom", text: "other" },
  ];
  assert.equal(
    tools.interactions.submit(id, {
      status: "answered",
      value: [values[0], values[0]],
    }).status,
    "pending",
  );
  tools.interactions.submit(id, { status: "answered", value: values });
  assert.deepEqual((await multiple).value, values);
  const confirmation = tools.user.ask({ question: "Agree?", mode: "confirm" });
  tools.interactions.submit(tools.interactions.list()[0].id, {
    status: "answered",
    value: false,
  });
  assert.deepEqual(await confirmation, { status: "answered", value: false });
  assert.equal(tools.signal.aborted, false);
  const skip = tools.user.ask({
    question: "Optional",
    mode: "text",
    allowSkip: true,
    schema: { type: "string", minLength: 100 },
  });
  tools.interactions.submit(tools.interactions.list()[0].id, {
    status: "skipped",
  });
  assert.deepEqual(await skip, { status: "skipped" });
  const cancelled = tools.user.ask({ question: "Waiting", mode: "confirm" });
  tools.cancel();
  await assert.rejects(cancelled, ExecutionCancelledError);
  assert.deepEqual(tools.interactions.list(), []);
});
