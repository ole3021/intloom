import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { connectProject, stopService } from "@intloom/cli";
import {
  cli,
  pending,
  projectFixture,
  refreshFixtureInstallation,
} from "./project-fixture.ts";

test("cancel presentation, repeated cancellation and terminal Run command exits preserve original results", async (t) => {
  const root = await projectFixture(t);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const client = await connectProject(root);
  try {
    const waiting = await client.flow("fixture", "cancel acceptance");
    const record = await client.getRecord(`once-${waiting.runId}`);
    assert.ok(record);
    const cancelled = await cli(root, ["cancel", waiting.runId, "--no-color"]);
    assert.equal(cancelled.code, 0);
    assert.match(cancelled.stdout, /^Stopped/u);
    assert.doesNotMatch(cancelled.stdout, /Execution failed/u);
    const stopped = await client.getRun(waiting.runId);
    assert.equal(stopped.status, "failed");
    assert.equal(stopped.lastError?.code, "RUN_STOPPED");
    assert.equal(stopped.pendingAction, undefined);
    const repeat = await cli(root, ["cancel", waiting.runId, "--json"]);
    assert.equal(repeat.code, 0);
    assert.deepEqual(JSON.parse(repeat.stdout).run, stopped);
    assert.deepEqual(await client.getRecord(`once-${waiting.runId}`), record);
    const attached = await cli(root, ["attach", waiting.runId, "--no-color"]);
    assert.equal(attached.code, 1);
    assert.match(attached.stdout, /^Stopped/u);
    assert.equal((await cli(root, ["runs"])).code, 0);
    assert.match((await cli(root, ["status"])).stdout, /failed or stopped 1/u);
    assert.equal(
      (await cli(root, ["cancel", "RUN-missing", "--json"])).code,
      1,
    );

    for (const intent of ["complete acceptance", "fail-after-commit"]) {
      const run = await client.flow("fixture", intent);
      const confirm = await client.answerAsk(run.runId, pending(run).id, [
        { questionId: "place", isSkipped: false, answer: "Local" },
        { questionId: "notes", isSkipped: true },
      ]);
      const done = await client.answerAsk(run.runId, pending(confirm).id, {
        isConfirmed: true,
      });
      assert.equal(
        done.status,
        intent === "fail-after-commit" ? "failed" : "completed",
      );
      const ignored = await cli(root, ["cancel", done.runId, "--no-color"]);
      assert.equal(ignored.code, 0);
      assert.match(ignored.stdout, /The Run has ended; no stop is needed/u);
      assert.deepEqual(await client.getRun(done.runId), done);
    }
  } finally {
    await client.close();
  }
});

test("a running flow stopped by another command returns nonzero with its unchanged JSON outcome", async (t) => {
  const root = await projectFixture(t);
  const filename = join(
    root,
    ".intloom/workflows/node_modules/fixture-workflow/workflow.js",
  );
  const source = await readFile(filename, "utf8");
  await writeFile(
    filename,
    source.replace(
      "const { id, intent } = access.state.value;",
      'const { id, intent } = access.state.value; if (intent === "hold-running") await new Promise(() => {});',
    ),
  );
  await refreshFixtureInstallation(root);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const client = await connectProject(root);
  const runningCommand = cli(root, [
    "flow",
    "fixture",
    "--intent",
    "hold-running",
    "--json",
  ]);
  try {
    let runs = await client.listRuns();
    const deadline = Date.now() + 5_000;
    while (!runs.length && Date.now() < deadline) {
      await delay(20);
      runs = await client.listRuns();
    }
    const run = runs[0];
    assert.ok(run);
    assert.equal(run.status, "running");
    assert.equal((await cli(root, ["cancel", run.runId, "--json"])).code, 0);
    const result = await runningCommand;
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).run.lastError.code, "RUN_STOPPED");
    assert.equal(result.stdout.trim().split("\n").length, 1);
  } finally {
    await client.close();
    await stopService(root);
    await runningCommand;
  }
});

for (const storage of ["file", "sqlite"] as const)
  test(`${storage}: concurrent and repeated stop are successful and durable data survives restart`, async (t) => {
    const root = await projectFixture(t, true, storage);
    const first = await cli(root, ["stop", "--json"]);
    assert.equal(first.code, 0);
    assert.deepEqual(JSON.parse(first.stdout), {
      projectRoot: root,
      stopped: false,
    });
    await assert.rejects(readFile(join(root, ".intloom/connection.json")), {
      code: "ENOENT",
    });
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const client = await connectProject(root);
    const waiting = await client.flow("fixture", "shutdown acceptance");
    const confirm = await client.answerAsk(waiting.runId, pending(waiting).id, [
      { questionId: "place", isSkipped: false, answer: "Local" },
      { questionId: "notes", isSkipped: true },
    ]);
    const done = await client.answerAsk(waiting.runId, pending(confirm).id, {
      isConfirmed: true,
    });
    const record = await client.getRecord(done.runId);
    await client.close();
    const stopped = await Promise.all([
      cli(root, ["stop", "--json"]),
      cli(root, ["stop", "--json"]),
    ]);
    for (const result of stopped) assert.equal(result.code, 0, result.stdout);
    assert.ok(stopped.some((result) => JSON.parse(result.stdout).stopped));
    assert.deepEqual(await stopService(root), {
      projectRoot: root,
      stopped: false,
    });
    const repeated = await cli(root, ["stop"]);
    assert.equal(repeated.code, 0);
    assert.match(
      repeated.stdout,
      /The service is not running; no stop is needed/u,
    );
    for (const path of [
      ".intloom/service.json",
      ".intloom/service.lock",
      ...(storage === "file" ? ["intloom/store.lock"] : []),
    ])
      await assert.rejects(readFile(join(root, path)), {
        code: "ENOENT",
      });
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const restarted = await connectProject(root);
    try {
      assert.deepEqual(await restarted.getRecord(done.runId), record);
    } finally {
      await restarted.close();
    }
  });

test("stop refuses crashed-host leftovers and leaves connection, locks and committed data unchanged", async (t) => {
  const root = await projectFixture(t);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const client = await connectProject(root);
  await client.flow("fixture", "retain committed record on crash");
  await client.close();
  const info = JSON.parse(
    await readFile(join(root, ".intloom/service.json"), "utf8"),
  );
  assert.equal(info.projectRoot, root);
  process.kill(info.pid, "SIGKILL");
  let exited = false;
  const deadline = Date.now() + 5_000;
  while (!exited && Date.now() < deadline) {
    try {
      process.kill(info.pid, 0);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ESRCH"
      )
        throw error;
      exited = true;
    }
    if (!exited) await delay(20);
  }
  assert.ok(
    exited,
    "Only the owned test host must have exited before inspecting leftovers",
  );
  const names = [
    ".intloom/connection.json",
    ".intloom/service.json",
    ".intloom/service.lock",
    "intloom/store.lock",
    "intloom/store.json",
  ];
  const before = await Promise.all(
    names.map((name) => readFile(join(root, name))),
  );
  const stopped = await cli(root, ["stop", "--json"]);
  assert.equal(stopped.code, 1);
  assert.equal(JSON.parse(stopped.stdout).error.code, "CLI_SERVICE_BUSY");
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(join(root, name)))),
    before,
  );
});
