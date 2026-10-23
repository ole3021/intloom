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
  untilRun,
} from "./project-fixture.ts";

test("cancel presentation, repeated cancellation and terminal Run command exits preserve original results", async (t) => {
  const root = await projectFixture(t);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const client = await connectProject(root);
  try {
    const receipt = await client.run("fixture", {
      prompt: "cancel acceptance",
    });
    const waiting = await untilRun(
      client,
      receipt.runId,
      (run) => run.status === "waiting",
    );
    const record = await client.getRecord(`once-${waiting.runId}`);
    assert.ok(record);
    const cancelled = await cli(root, ["cancel", waiting.runId, "--no-color"]);
    assert.equal(cancelled.code, 0);
    assert.match(cancelled.stdout, /Stopped/u);
    assert.doesNotMatch(cancelled.stdout, /Execution failed/u);
    const stopped = await client.getRun(waiting.runId);
    assert.equal(stopped.status, "failed");
    assert.equal(stopped.lastError?.code, "RUN_STOPPED");
    assert.equal(stopped.pendingAction, undefined);
    const repeat = await cli(root, ["cancel", waiting.runId, "--json"]);
    assert.equal(repeat.code, 0);
    const repeated = JSON.parse(repeat.stdout).data;
    assert.equal(repeated.receipt.status, "accepted");
    const repeatRun = repeated.run;
    assert.equal(repeatRun.status, stopped.status);
    assert.equal(repeatRun.updatedAt, stopped.updatedAt);
    assert.deepEqual(repeatRun.lastError, stopped.lastError);
    assert.ok(stopped.revision !== undefined);
    assert.ok(repeatRun.revision >= stopped.revision);
    assert.deepEqual(await client.getRecord(`once-${waiting.runId}`), record);
    const attached = await cli(root, ["attach", waiting.runId, "--no-color"]);
    assert.equal(attached.code, 1);
    assert.match(attached.stdout, /Stopped/u);
    assert.equal((await cli(root, ["runs"])).code, 0);
    assert.match((await cli(root, ["status"])).stdout, /failed or stopped 1/u);
    assert.equal(
      JSON.parse((await cli(root, ["status", "--json"])).stdout).data.service
        .failedRuns,
      1,
    );
    assert.equal(
      (await cli(root, ["cancel", "RUN-missing", "--json"])).code,
      1,
    );

    for (const intent of ["complete acceptance", "fail-after-commit"]) {
      const receipt = await client.run("fixture", { prompt: intent });
      const run = await untilRun(
        client,
        receipt.runId,
        (view) => view.status === "waiting",
      );
      const confirmReceipt = await client.answerAsk(
        run.runId,
        pending(run).id,
        [
          { questionId: "place", isSkipped: false, answer: "Local" },
          { questionId: "notes", isSkipped: true },
        ],
      );
      assert.equal(confirmReceipt.status, "running");
      const confirm = await untilRun(
        client,
        run.runId,
        (view) =>
          view.status === "waiting" &&
          view.pendingAction?.id !== run.pendingAction?.id,
      );
      const doneReceipt = await client.answerAsk(
        run.runId,
        pending(confirm).id,
        {
          isConfirmed: true,
        },
      );
      assert.equal(doneReceipt.status, "running");
      const expectedStatus =
        intent === "fail-after-commit" ? "failed" : "completed";
      const done = await untilRun(
        client,
        run.runId,
        (view) => view.status === expectedStatus && view.settled === true,
      );
      assert.equal(done.status, expectedStatus);
      const ignored = await cli(root, ["cancel", done.runId, "--no-color"]);
      assert.equal(ignored.code, 0);
      assert.match(ignored.stdout, /Status (completed|failed)/u);
      assert.deepEqual(await client.getRun(done.runId), done);
    }
  } finally {
    await client.close();
  }
});

test("a running run returns its Run ID before another command stops it", async (t) => {
  const root = await projectFixture(t);
  const filename = join(
    root,
    ".intloom/looms/node_modules/fixture-loom/loom.js",
  );
  const source = await readFile(filename, "utf8");
  await writeFile(
    filename,
    source.replace(
      "const { id, intent } = access.state.value;",
      'const { id, intent } = access.state.value; if (intent === "hold-running") await new Promise(resolve => access.signal.addEventListener("abort", resolve, {once:true}));',
    ),
  );
  await refreshFixtureInstallation(root);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const client = await connectProject(root);
  const runningCommand = cli(root, [
    "run",
    "fixture",
    "--prompt",
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
    assert.equal(result.code, 0);
    const receipt = JSON.parse(result.stdout).data.run;
    assert.equal(receipt.runId, run.runId);
    assert.equal(receipt.status, "running");
    assert.equal(result.stdout.trim().split("\n").length, 1);
    assert.equal(
      (await client.getRun(run.runId)).lastError?.code,
      "RUN_STOPPED",
    );
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
    assert.deepEqual(JSON.parse(first.stdout).data, {
      projectRoot: root,
      stopped: false,
    });
    await assert.rejects(readFile(join(root, ".intloom/connection.json")), {
      code: "ENOENT",
    });
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const info = JSON.parse(
      await readFile(join(root, ".intloom/service.json"), "utf8"),
    );
    assert.match(info.logFile, /^LOG-\d{8}T\d{9}Z\.jsonl$/u);
    const client = await connectProject(root);
    const receipt = await client.run("fixture", {
      prompt: "shutdown acceptance",
    });
    const waiting = await untilRun(
      client,
      receipt.runId,
      (run) => run.status === "waiting",
    );
    const confirmReceipt = await client.answerAsk(
      waiting.runId,
      pending(waiting).id,
      [
        { questionId: "place", isSkipped: false, answer: "Local" },
        { questionId: "notes", isSkipped: true },
      ],
    );
    assert.equal(confirmReceipt.status, "running");
    const confirm = await untilRun(
      client,
      waiting.runId,
      (run) =>
        run.status === "waiting" &&
        run.pendingAction?.id !== waiting.pendingAction?.id,
    );
    const doneReceipt = await client.answerAsk(
      waiting.runId,
      pending(confirm).id,
      {
        isConfirmed: true,
      },
    );
    assert.equal(doneReceipt.status, "running");
    const done = await untilRun(
      client,
      waiting.runId,
      (run) => run.status === "completed",
    );
    const record = await client.getRecord(done.runId);
    await client.close();
    const stopped = await Promise.all([
      cli(root, ["stop", "--json"]),
      cli(root, ["stop", "--json"]),
    ]);
    const responses = stopped.map((result) => {
      let body: unknown;
      try {
        body = JSON.parse(result.stdout);
      } catch {
        return {
          exitCode: result.code,
          json: false,
          stdoutBytes: Buffer.byteLength(result.stdout),
          stderrBytes: Buffer.byteLength(result.stderr),
          stderr: result.stderr.slice(0, 400),
          stderrMarker: [
            "ENOENT",
            "EACCES",
            "CLI_SERVICE_",
            "ERR_",
            "uncaughtException",
          ].find((marker) => result.stderr.includes(marker)),
        };
      }
      const value = body && typeof body === "object" ? body : {};
      const error =
        "error" in value && value.error && typeof value.error === "object"
          ? value.error
          : {};
      return {
        exitCode: result.code,
        json: true,
        stdoutBytes: Buffer.byteLength(result.stdout),
        stderrBytes: Buffer.byteLength(result.stderr),
        stderrMarker: [
          "ENOENT",
          "EACCES",
          "CLI_SERVICE_",
          "ERR_",
          "uncaughtException",
        ].find((marker) => result.stderr.includes(marker)),
        stopped: "stopped" in value && value.stopped === true,
        errorCode:
          "code" in error &&
          typeof error.code === "string" &&
          /^CLI_[A-Z_]+$/u.test(error.code)
            ? error.code
            : undefined,
      };
    });
    const hostEvents = (
      await readFile(join(root, ".intloom/logs", info.logFile), "utf8")
    )
      .trim()
      .split("\n")
      .flatMap((line) => {
        try {
          const row: unknown = JSON.parse(line);
          if (!row || typeof row !== "object" || !("event" in row)) return [];
          return [
            "service_ready",
            "service_stopping",
            "service_stopped",
            "service_stop_failed",
          ].includes(row.event as string)
            ? [row.event]
            : [];
        } catch {
          return [];
        }
      });
    for (const result of stopped)
      assert.equal(result.code, 0, JSON.stringify({ responses, hostEvents }));
    assert.ok(stopped.some((result) => JSON.parse(result.stdout).data.stopped));
    assert.deepEqual(await stopService(root), {
      projectRoot: root,
      stopped: false,
    });
    const repeated = await cli(root, ["stop"]);
    assert.equal(repeated.code, 0);
    assert.match(repeated.stdout, /^Service already stopped/u);
    assert.equal(
      JSON.parse((await cli(root, ["stop", "--json"])).stdout).data.stopped,
      false,
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
  const receipt = await client.run("fixture", {
    prompt: "retain committed record on crash",
  });
  await untilRun(client, receipt.runId, (run) => run.status === "waiting");
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
