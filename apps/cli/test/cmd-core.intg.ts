import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { createCliCore } from "@intloom/cli";
import { bin, cli, projectFixture } from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";

test("CMD preserves full intent, returns admission, answers JSON and shares authoritative Run metadata", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const started = await core.startService({ projectPath });
  assert.ok(started.ok);
  const serviceInstanceId = started.data.service.instanceId,
    operationId = randomUUID();
  const intent = "  中文\n完整意图 --project literal `x` $quoted  ";
  const args = [
    "flow",
    "fixture",
    "--intent",
    intent,
    "--instance",
    serviceInstanceId,
    "--operation-id",
    operationId,
    "--json",
  ];
  const first = await cli(projectPath, args);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  assert.equal(first.stderr, "");
  const admission = JSON.parse(first.stdout);
  assert.equal(admission.ok, true);
  assert.equal(admission.data.receipt.status, "accepted");
  const runId = admission.data.run.runId;
  const again = JSON.parse((await cli(projectPath, args)).stdout);
  assert.equal(again.data.receipt.runId, runId);
  const waited = await core.waitRun({ projectPath, serviceInstanceId, runId });
  assert.ok(waited.ok && waited.data.run.pendingAction);
  const pending = waited.data.run.pendingAction;
  const answer = [
    { questionId: "place", isSkipped: false, answer: "  完整\n回答  " },
    { questionId: "notes", isSkipped: true },
  ];
  const accepted = await cli(projectPath, [
    "answer",
    runId,
    "--action",
    pending.id,
    "--answer",
    JSON.stringify(answer),
    "--json",
  ]);
  assert.equal(accepted.code, 0, accepted.stdout);
  const next = await core.waitRun({ projectPath, serviceInstanceId, runId });
  assert.ok(next.ok && next.data.run.pendingAction);
  assert.notEqual(next.data.run.pendingAction.id, pending.id);
  assert.ok(
    (
      await core.answerAsk({
        projectPath,
        serviceInstanceId,
        runId,
        operationId: randomUUID(),
        actionId: next.data.run.pendingAction.id,
        answer: { isConfirmed: true },
      })
    ).ok,
  );
  const done = await core.waitRun({
    projectPath,
    serviceInstanceId,
    runId,
    until: "terminal",
  });
  assert.ok(done.ok);
  assert.equal(done.data.run.status, "completed");
  assert.ok(
    done.data.run.results?.some(
      (item) => item.kind === "record" && item.id === runId,
    ),
  );
  const record = await core.getRecord({ projectPath, recordId: runId });
  assert.ok(record.ok && record.data);
  assert.deepEqual(record.data.data, {
    intent,
    answers: answer,
    isConfirmed: true,
  });
  const inspected = JSON.parse(
    (await cli(projectPath, ["attach", runId, "--json"])).stdout,
  );
  assert.equal(inspected.data.metrics.serviceInstanceId, serviceInstanceId);
  assert.equal(inspected.data.revision, done.data.run.revision);
});

test("compound init preserves scaffold on later failure and Codex plans protect unrelated/concurrent configuration", async (t) => {
  const root = await temporaryDirectory(t),
    core = createCliCore();
  const projectPath = join(root, "partial");
  const partial = await core.initProject({
    projectPath,
    workflows: [join(root, "missing.tgz")],
  });
  assert.equal(partial.ok, false);
  if (!partial.ok) {
    assert.equal(partial.outcome, "applied");
    assert.equal(partial.data?.steps[0]?.status, "completed");
    assert.equal(partial.data?.steps[1]?.status, "failed");
  }
  assert.match(
    await readFile(join(projectPath, "intloom.yaml"), "utf8"),
    /workflows/u,
  );
  await mkdir(join(projectPath, ".codex"));
  const file = join(projectPath, ".codex/config.toml");
  await writeFile(file, '# retained comment\nmodel = "example"\n');
  const plan = await core.planMcpConfig({ projectPath, ide: "codex" });
  assert.ok(plan.ok);
  assert.equal(plan.data.status, "create");
  assert.doesNotMatch(plan.data.snippet, /Bearer|http:\/\/|token/u);
  await writeFile(file, '# retained comment\nmodel = "changed"\n');
  const conflict = await core.applyMcpConfig({
    projectPath,
    ide: "codex",
    beforeHash: plan.data.beforeHash,
  });
  assert.equal(conflict.ok, false);
  const updated = await core.planMcpConfig({ projectPath, ide: "codex" });
  assert.ok(updated.ok);
  const applied = await core.applyMcpConfig({
    projectPath,
    ide: "codex",
    beforeHash: updated.data.beforeHash,
  });
  assert.ok(applied.ok);
  const text = await readFile(file, "utf8");
  assert.match(text, /# retained comment\nmodel = "changed"/u);
  assert.match(text, /mcp_servers.intloom/u);
  const same = await core.planMcpConfig({ projectPath, ide: "codex" });
  assert.ok(same.ok);
  assert.equal(same.data.status, "unchanged");
});

test("built CLI --no-color overrides inherited FORCE_COLOR without stderr warnings", async () => {
  const result = await promisify(execFile)(
    process.execPath,
    [bin, "--help", "--no-color"],
    {
      env: { ...process.env, FORCE_COLOR: "1" },
    },
  );
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes("\u001b"), false);
  assert.match(result.stdout, /flow\s+Submit complete intent/u);
});

test("CMD defaults to readable text while explicit JSON retains the envelope, streams and exit status", {
  timeout: 20000,
}, async (t) => {
  const projectPath = await projectFixture(t);
  const core = createCliCore();
  const started = await cli(projectPath, ["start", "--no-color"]);
  assert.equal(started.code, 0, started.stderr);
  assert.match(started.stdout, /^Service started/u);
  assert.equal(started.stderr, "");
  for (const [args, label] of [
    [["status"], /^Service running/u],
    [["flows"], /^Workflows \(1\)/u],
    [["runs"], /^No Runs/u],
    [["doctor"], /^Project checks/u],
    [["workflow", "list"], /^Workflow packages/u],
    [["config", "show"], /^Project configuration/u],
    [["mcp", "init", "--ide", "codex", "--plan"], /^MCP configuration create/u],
    [["logs", "--service"], /INFO\s+service ready/u],
    [["artifacts"], /^No artifacts found/u],
    [["records"], /^No records found/u],
  ] as const) {
    const human = await cli(projectPath, [...args]);
    assert.equal(human.code, 0, human.stdout + human.stderr);
    assert.equal(human.stderr, "");
    assert.match(human.stdout, label);
    assert.doesNotMatch(human.stdout, /"ok":|"meta":/u);
    assert.equal(human.stdout.includes("\u001b"), false);
    assert.throws(() => JSON.parse(human.stdout));
    const machine = await cli(projectPath, [...args, "--json"]);
    assert.equal(machine.code, human.code, machine.stdout + machine.stderr);
    assert.equal(machine.stderr, "");
    const result = JSON.parse(machine.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.meta.projectRoot, projectPath);
    assert.ok(result.meta.requestId);
  }
  const missing = await cli(projectPath, ["attach", "RUN-missing"]);
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /NOT_FOUND:/u);
  const machineMissing = await cli(projectPath, [
    "attach",
    "RUN-missing",
    "--json",
  ]);
  assert.equal(machineMissing.code, 1);
  assert.equal(machineMissing.stderr, "");
  assert.equal(JSON.parse(machineMissing.stdout).error.code, "NOT_FOUND");
  const stopped = await core.stopService({ projectPath });
  assert.ok(stopped.ok);
});
