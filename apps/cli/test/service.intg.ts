import assert from "node:assert/strict";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { request } from "node:http";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import {
  connectProject,
  runCli,
  serviceStatus,
  startService,
} from "@intloom/cli";
import {
  cli,
  connection,
  pending,
  projectFixture,
  configureProject,
} from "./project-fixture.ts";

const answers = [
  { questionId: "place", isSkipped: false, answer: "Local" },
  { questionId: "notes", isSkipped: true },
];
for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: CLI daemon, flow, cross-client continuation, restart and durable data`, {
    timeout: 30_000,
  }, async (t) => {
    const root = await projectFixture(t, true, backend);
    const started = await cli(root, ["start", "--json"]);
    assert.equal(started.code, 0, started.stdout);
    const first = JSON.parse(started.stdout).service;
    const reused = JSON.parse((await cli(root, ["start", "--json"])).stdout);
    assert.equal(reused.reused, true);
    assert.equal(reused.service.instanceId, first.instanceId);
    const created = await cli(root, [
      "flow",
      "fixture",
      "--intent",
      "  original\nintent  ",
      "--json",
    ]);
    assert.equal(created.code, 0, created.stdout);
    const initial = JSON.parse(created.stdout).run;
    assert.equal(initial.status, "waiting");
    const client = await connectProject(root);
    const confirmation = await client.answerAsk(
      initial.runId,
      initial.pendingAction.id,
      answers,
    );
    assert.equal(confirmation.runId, initial.runId);
    assert.equal(confirmation.pendingAction?.kind, "user_ask_confirmation");
    await assert.rejects(
      client.answerAsk(initial.runId, initial.pendingAction.id, answers),
      { code: "CONFLICT" },
    );
    const done = await client.answerAsk(
      initial.runId,
      pending(confirmation).id,
      { isConfirmed: true },
    );
    assert.equal(done.status, "completed");
    assert.equal((await client.listRuns()).length, 1);
    const record = await client.getRecord(done.runId);
    assert.ok(record && typeof record === "object" && "data" in record);
    assert.deepEqual(record.data, {
      intent: "  original\nintent  ",
      answers,
      isConfirmed: true,
    });
    await client.close();
    const saved = await connection(root);
    const config = await cli(root, ["config", "codex"]);
    assert.match(config.stdout, /http_headers_helper = "/u);
    assert.doesNotMatch(config.stdout, new RegExp(saved.token, "u"));
    const stopped = await cli(root, ["stop", "--json"]);
    assert.equal(stopped.code, 0, stopped.stdout);
    assert.equal(
      JSON.parse((await cli(root, ["status", "--json"])).stdout).status,
      "offline",
    );
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const restarted = await serviceStatus(root);
    assert.notEqual(restarted.instanceId, first.instanceId);
    assert.equal(restarted.url, first.url);
    assert.equal((await connection(root)).token, saved.token);
    const next = await connectProject(root);
    assert.equal((await next.listRuns()).length, 0);
    assert.deepEqual(await next.getRecord(done.runId), record);
    await next.close();
    if (process.platform !== "win32")
      assert.equal(
        (await lstat(join(root, ".intloom/connection.json"))).mode & 0o077,
        0,
      );
  });

test("JSON waiting, invalid answers, cancellation and failed commit remain observable", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const client = await connectProject(root);
  t.after(() => client.close());
  const waiting = await client.flow("fixture", "normal");
  await assert.rejects(
    client.answerAsk(waiting.runId, pending(waiting).id, []),
    { code: "INVALID_REQUEST" },
  );
  assert.deepEqual(await client.getRun(waiting.runId), waiting);
  const cancelled = await cli(root, ["cancel", waiting.runId, "--json"]);
  assert.equal(cancelled.code, 0);
  assert.equal(JSON.parse(cancelled.stdout).run.lastError.code, "RUN_STOPPED");
  const failure = await client.flow("fixture", "fail-after-commit");
  const confirm = await client.answerAsk(
    failure.runId,
    pending(failure).id,
    answers,
  );
  const failed = await client.answerAsk(failure.runId, pending(confirm).id, {
    isConfirmed: true,
  });
  assert.equal(failed.status, "failed");
  assert.notEqual(await client.getRecord(failure.runId), null);
  const attached = await cli(root, ["attach", failed.runId, "--json"]);
  assert.equal(attached.code, 1);
  assert.equal(attached.stdout.trim().split("\n").length, 1);
  assert.equal(JSON.parse(attached.stdout).run.status, "failed");
});

test("interactive CLI selection, multiline intent, questions and confirmation use the same service", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const replies = [
    "fixture",
    "  original\nintent  ",
    "custom",
    "  custom\nanswer  ",
    "skip",
    "revise",
    "Changes needed",
  ];
  const output = new PassThrough();
  const error = new PassThrough();
  let stdout = "";
  output.on("data", (data) => {
    stdout += data;
  });
  error.resume();
  const code = await runCli(["--project", root, "flow"], {
    input: new PassThrough(),
    output,
    error,
    cwd: root,
    isTTY: true,
    prompts: {
      async choose() {
        return replies.shift();
      },
      async text() {
        return replies.shift();
      },
    },
  });
  assert.equal(code, 0);
  assert.match(stdout, /Completed/u);
  const client = await connectProject(root);
  const run = (await client.listRuns())[0];
  assert.ok(run);
  const record = await client.getRecord(run.runId);
  assert.ok(record && typeof record === "object" && "data" in record);
  assert.deepEqual(record.data, {
    intent: "  original\nintent  ",
    answers: [
      { questionId: "place", isSkipped: false, answer: "  custom\nanswer  " },
      { questionId: "notes", isSkipped: true },
    ],
    isConfirmed: false,
    feedback: "Changes needed",
  });
  await client.close();
});

test("CLI form cancellation leaves waiting for attach without replay", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const output = new PassThrough();
  const error = new PassThrough();
  output.resume();
  error.resume();
  await runCli(["--project", root, "flow", "fixture", "--intent", "retain"], {
    input: new PassThrough(),
    output,
    error,
    cwd: root,
    isTTY: true,
    prompts: {
      async choose() {
        return undefined;
      },
      async text() {
        assert.fail();
      },
    },
  });
  const client = await connectProject(root);
  const initial = (await client.listRuns())[0];
  assert.ok(initial);
  assert.equal(initial.status, "waiting");
  assert.equal((await cli(root, ["attach", initial.runId, "--json"])).code, 0);
  assert.deepEqual(await client.getRun(initial.runId), initial);
  assert.notEqual(await client.getRecord(`once-${initial.runId}`), null);
  await client.close();
});

test("loopback service enforces auth, Host/Origin and shutdown identity", async (t) => {
  const root = await projectFixture(t);
  const { service } = await startService({ projectRoot: root });
  const saved = await connection(root);
  const url = new URL("/_status", service.url);
  assert.equal((await fetch(url)).status, 401);
  const hostRejected = await new Promise<number | undefined>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          headers: {
            authorization: `Bearer ${saved.token}`,
            host: "attacker.invalid",
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    },
  );
  assert.equal(hostRejected, 403);
  assert.equal(
    (
      await fetch(url, {
        headers: {
          authorization: `Bearer ${saved.token}`,
          origin: "https://attacker.invalid",
        },
      })
    ).status,
    403,
  );
  const rejected = await fetch(new URL("/_stop", service.url), {
    method: "POST",
    headers: {
      authorization: `Bearer ${saved.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ instanceId: "wrong-instance" }),
  });
  assert.equal(rejected.status, 409);
  assert.equal((await serviceStatus(root)).instanceId, service.instanceId);
  await configureProject(root, { localStorage: "sqlite" });
  await assert.rejects(startService({ projectRoot: root }), {
    code: "CLI_SERVICE_CONFLICT",
  });
});

test("invalid project/startup failure/stale locks do not publish a live service", async (t) => {
  const root = await projectFixture(t, false);
  await writeFile(join(root, "intloom.yaml"), "invalid: yes\n");
  await assert.rejects(startService({ projectRoot: root }), {
    code: "INVALID_REQUEST",
  });
  await assert.rejects(lstat(join(root, ".intloom/service.lock")), {
    code: "ENOENT",
  });
  await assert.rejects(lstat(join(root, ".intloom/service.json")), {
    code: "ENOENT",
  });
  await writeFile(join(root, ".intloom/service.lock"), '{"pid":9999999}', {
    mode: 0o600,
  });
  await assert.rejects(startService({ projectRoot: root }), {
    code: "CLI_SERVICE_BUSY",
  });
  assert.equal(
    await readFile(join(root, ".intloom/service.lock"), "utf8"),
    '{"pid":9999999}',
  );
  const invalid = join(root, "invalid-project");
  await mkdir(invalid);
  assert.equal((await cli(invalid, ["start", "--json"])).code, 1);
  await assert.rejects(lstat(join(invalid, ".intloom")), { code: "ENOENT" });
});

test("public metadata cannot redirect credentials or impersonate another project", async (t) => {
  const root = await projectFixture(t);
  await startService({ projectRoot: root });
  const filename = join(root, ".intloom/service.json");
  const original = await readFile(filename, "utf8");
  try {
    await writeFile(
      filename,
      JSON.stringify({
        ...JSON.parse(original),
        url: "https://attacker.invalid/mcp",
      }),
    );
    await assert.rejects(serviceStatus(root), {
      code: "CLI_SERVICE_METADATA_INVALID",
    });
    if (process.platform !== "win32") {
      await chmod(filename, 0o644);
      await assert.rejects(serviceStatus(root), {
        code: "CLI_SERVICE_METADATA_INVALID",
      });
    }
  } finally {
    await chmod(filename, 0o600);
    await writeFile(filename, original);
  }
});
