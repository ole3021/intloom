import assert from "node:assert/strict";
import {
  readFile,
  readdir,
  writeFile,
  appendFile,
  stat,
} from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { test } from "node:test";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  connectProject,
  startService,
  stopService,
  startProjectHost,
} from "@intloom/cli";
import {
  cli,
  connection,
  pending,
  projectFixture,
  refreshFixtureInstallation,
} from "./project-fixture.ts";

test("daemon logging is flat, independent of CLI level, scoped by Run, and readable after restart", {
  timeout: 30_000,
}, async (t) => {
  const root = await projectFixture(t);
  const started = await cli(root, ["start", "--info", "--json"]);
  assert.equal(started.code, 0, started.stdout);
  assert.match(started.stderr, /service ready/u);
  assert.doesNotMatch(started.stderr, /DEBUG/u);
  assert.ok(!started.stderr.includes("\u001b"));
  const service = JSON.parse(started.stdout).service;
  assert.match(service.logFile, /^LOG-\d{8}T\d{9}Z\.jsonl$/u);
  const folder = join(root, ".intloom", "logs");
  const file = join(folder, service.logFile);
  const reused = await startService({ projectRoot: root });
  assert.equal(reused.reused, true);
  assert.deepEqual(await readdir(folder), [service.logFile]);

  const hidden = await cli(root, [
    "flow",
    "fixture",
    "--intent",
    "PRIVATE_INTENT",
    "--json",
  ]);
  assert.equal(hidden.code, 0, hidden.stdout);
  assert.equal(hidden.stderr, "");
  const initial = JSON.parse(hidden.stdout).run;
  assert.match(initial.runId, /^RUN-\d{8}T\d{9}Z-[\w-]{21}$/u);
  const visible = await cli(root, [
    "flow",
    "fixture",
    "--intent",
    "PRIVATE_SECOND",
    "--debug",
    "--json",
  ]);
  assert.equal(visible.code, 0, visible.stdout);
  assert.match(visible.stderr, /step started/u);
  assert.match(visible.stderr, /DEBUG/u);
  assert.doesNotMatch(visible.stderr, /PRIVATE_/u);
  assert.ok(!visible.stderr.includes("\u001b"));
  const second = JSON.parse(visible.stdout).run;
  const client = await connectProject(root);
  try {
    const confirm = await client.answerAsk(
      initial.runId,
      initial.pendingAction.id,
      [
        { questionId: "place", isSkipped: false, answer: "PRIVATE_ANSWER" },
        { questionId: "notes", isSkipped: true },
      ],
    );
    const done = await client.answerAsk(confirm.runId, pending(confirm).id, {
      isConfirmed: true,
    });
    assert.equal(done.status, "completed");
    await client.cancelRun(second.runId);
  } finally {
    await client.close();
  }
  const saved = await connection(root);
  await stopService(root);
  const text = await readFile(file, "utf8");
  for (const secret of [
    "PRIVATE_INTENT",
    "PRIVATE_SECOND",
    "PRIVATE_ANSWER",
    saved.token,
  ])
    assert.ok(!text.includes(secret), secret);
  const rows = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const own = rows.filter((row) => row.runId === initial.runId);
  assert.equal(own.filter((row) => row.event === "run_started").length, 1);
  assert.ok(!rows.some((row) => row.event === "run_created"));
  assert.ok(
    own
      .filter((row) => row.event === "storage_committed")
      .every(
        (row) => row.artifacts === undefined && row.removedCount === undefined,
      ),
  );
  assert.ok(own.some((row) => row.event === "run_completed"));
  assert.ok(own.some((row) => row.event === "storage_committed"));
  assert.ok(own.some((row) => row.event === "run_resumed"));
  assert.ok(
    rows.some(
      (row) => row.runId === second.runId && row.event === "run_stopped",
    ),
  );
  assert.equal(rows.at(-1).event, "log_closed");
  const history = await cli(root, ["logs", initial.runId, "--json", "--debug"]);
  assert.equal(history.code, 0, history.stdout);
  assert.ok(
    history.stdout
      .trim()
      .split("\n")
      .every((line) => JSON.parse(line).runId === initial.runId),
  );
  const restart = await startService({ projectRoot: root });
  assert.notEqual(restart.service.logFile, service.logFile);
  assert.equal((await readdir(folder)).length, 2);
});

test("a commit-start logging failure cancels the Run before a durable write begins", async (t) => {
  const root = await projectFixture(t);
  const host = await startProjectHost({ projectRoot: root });
  t.after(() => host.close().catch(() => undefined));
  const original = fs.writeSync;
  t.mock.method(fs, "writeSync", (...args: Parameters<typeof fs.writeSync>) => {
    if (String(args[1]).includes('"event":"storage_commit_started"'))
      throw new Error("Simulated commit log failure.");
    return Reflect.apply(original, fs, args);
  });
  syncBuiltinESMExports();
  try {
    const blueprint = Object.values(host.execution.registries.blueprints)[0];
    assert.ok(blueprint);
    const run = await host.execution.runtime.flow(blueprint, "PRIVATE_COMMIT");
    assert.equal(run.lastError?.code, "RUN_STOPPED");
    assert.equal(
      await host.storage.access.getRecordById(`once-${run.runId}`),
      undefined,
    );
    await assert.rejects(host.storage.access.commit([]), {
      code: "LOG_WRITE_FAILED",
    });
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  await assert.rejects(host.close(), { code: "LOG_WRITE_FAILED" });
});

for (const origin of ["uncaught_exception", "unhandled_rejection"] as const) {
  test(`${origin}: daemon records a sanitized fatal event and exits without a clean-close seal`, {
    timeout: 15_000,
  }, async (t) => {
    const root = await projectFixture(t);
    await appendFile(
      join(
        root,
        ".intloom/workflows/node_modules/fixture-workflow/workflow.js",
      ),
      `
process.on("unhandledRejection", () => {});
process.once("message", () => setImmediate(() => {
  const error = new Error("PRIVATE_FATAL_MESSAGE");
  error.code = "FIXTURE_FATAL";
  ${origin === "uncaught_exception" ? "throw error;" : "void Promise.reject(error);"}
}));
`,
    );
    await refreshFixtureInstallation(root);
    const child = fork(
      new URL("../dist/service/entry.js", import.meta.url),
      [JSON.stringify({ projectRoot: root })],
      {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        execArgv: ["--unhandled-rejections=strict"],
      },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    });
    const exited = once(child, "exit");
    const info = await new Promise<{ logFile: string }>(
      (resolveReady, rejectReady) => {
        child.on("message", (message) => {
          if (
            message &&
            typeof message === "object" &&
            "instanceId" in message &&
            "logFile" in message &&
            typeof message.logFile === "string"
          )
            resolveReady({ logFile: message.logFile });
        });
        child.once("error", rejectReady);
        child.once("exit", () =>
          rejectReady(new Error("Daemon exited before ready.")),
        );
      },
    );
    child.send("crash");
    const [code] = await exited;
    assert.notEqual(code, 0);
    const file = join(root, ".intloom/logs", info.logFile);
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /PRIVATE_FATAL_MESSAGE/u);
    const rows = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const fatal = rows.filter((row) => row.event === "process_failed");
    assert.equal(fatal.length, 1);
    assert.equal(fatal[0].level, 60);
    assert.equal(fatal[0].origin, origin);
    assert.equal(fatal[0].err.code, "FIXTURE_FATAL");
    assert.notEqual(rows.at(-1).event, "log_closed");
    assert.notEqual((await stat(file)).mode & 0o222, 0);
  });
}

test("startup failures are logged before readiness without configuration contents", async (t) => {
  const root = await projectFixture(t);
  await writeFile(join(root, "intloom.yaml"), "broken: [PRIVATE_CONFIG");
  const result = await cli(root, ["start", "--debug", "--json"]);
  assert.notEqual(result.code, 0);
  const folder = join(root, ".intloom", "logs");
  const files = await readdir(folder);
  assert.equal(files.length, 1);
  const text = await readFile(join(folder, files[0] ?? ""), "utf8");
  assert.match(text, /service_start_failed/u);
  assert.doesNotMatch(text, /PRIVATE_CONFIG/u);
});

test("a poisoned log stops waiting Runs, rejects new work, and keeps status and cleanup available", async (t) => {
  const root = await projectFixture(t);
  const host = await startProjectHost({ projectRoot: root });
  t.after(() => host.close().catch(() => undefined));
  const client = await connectProject(root);
  t.after(() => client.close());
  const waiting = await client.flow("fixture", "private");
  t.mock.method(fs, "writeSync", () => {
    throw new Error("Simulated log I/O failure.");
  });
  syncBuiltinESMExports();
  try {
    await client.getRun(waiting.runId);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal((await host.status()).logError?.code, "LOG_WRITE_FAILED");
  assert.equal(
    (await host.execution.runtime.getRun(waiting.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  await assert.rejects(client.flow("fixture", "new private intent"));
  assert.equal((await host.execution.runtime.listRuns()).length, 1);
  await assert.rejects(host.close(), { code: "LOG_WRITE_FAILED" });
});
