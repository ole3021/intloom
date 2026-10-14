import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Evidence } from "./evidence.ts";
import { Progress } from "./progress.ts";

test("E2E progress reports state changes and failures without polling, model payloads or system output", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-progress-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lines: string[] = [];
  const evidence = new Evidence(
    root,
    new Progress((line) => lines.push(line)).handle,
  );
  evidence.secrets.push("provider-secret");
  await evidence.event("execution_started", {
    entry: "cmd",
    caseId: "S01",
    directory: root,
  });
  const run = {
    runId: "RUN-one",
    status: "waiting",
    cursor: { stageName: "specification", stepName: "clarify" },
    actionId: "ASK-one",
  };
  for (let count = 0; count < 20; count++) {
    await evidence.event("run_observed", run);
    await evidence.event("model_step", {
      actor: "user",
      finishReason: "tool-calls",
    });
    await evidence.event("cli", {
      args: ["run", "show"],
      result: { code: 0, stdout: "SYSTEM OUTPUT" },
    });
    await evidence.event("model_tools", { calls: ["PRIVATE ANSWER"] });
  }
  await evidence.event("run_observed", {
    ...run,
    status: "running",
    actionId: undefined,
  });
  await evidence.event("run_observed", {
    ...run,
    status: "running",
    actionId: undefined,
    stepVisitId: 13,
  });
  await evidence.event("cli", {
    args: ["start"],
    result: { code: 0, stdout: "SYSTEM OUTPUT", stderr: "SYSTEM ERROR" },
  });
  await evidence.event("failure", {
    code: "USER_ACTION_PROTOCOL_ERROR",
    category: "model",
    message: "Rejected provider-secret\nanswer",
    ownerToken: "owner-secret",
  });
  await evidence.event("execution_finished", {
    status: "failed",
    checksPassed: 0,
    checksTotal: 13,
    mirrors: 8,
    cleanup: "stopped",
  });
  assert.equal(lines.length, 7);
  assert.match(lines.join(""), /\(visit 13\)/u);
  assert.equal(
    lines.filter((line) => line.includes("Run RUN-one waiting")).length,
    1,
  );
  assert.match(lines.join(""), /USER_ACTION_PROTOCOL_ERROR/u);
  assert.match(lines.join(""), /Rejected \[REDACTED\] answer/u);
  for (const value of [
    "provider-secret",
    "owner-secret",
    "SYSTEM OUTPUT",
    "SYSTEM ERROR",
    "PRIVATE ANSWER",
  ])
    assert.equal(lines.join("").includes(value), false);
  assert.ok(
    lines.every(
      (line) => line.endsWith("\n") && line.indexOf("\n") === line.length - 1,
    ),
  );
  assert.ok(
    (await readFile(join(root, "actions.jsonl"), "utf8")).includes(
      "SYSTEM OUTPUT",
    ),
  );
});

test("E2E waiting heartbeat is bounded and stops when progress closes", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 1000 });
  const lines: string[] = [];
  const progress = new Progress((line) => lines.push(line));
  progress.start();
  t.mock.timers.tick(29999);
  assert.equal(lines.length, 0);
  t.mock.timers.tick(1);
  assert.match(lines[0] ?? "", /Still active: preparing execution/u);
  progress.handle({
    sequence: 1,
    at: "test",
    kind: "model_started",
    data: { actor: "worker", model: "test" },
  });
  progress.handle({
    sequence: 2,
    at: "test",
    kind: "model_connection_started",
    data: { actor: "simulated-user-1" },
  });
  t.mock.timers.tick(30000);
  assert.match(lines.at(-1) ?? "", /Still active: AI simulated-user-1/);
  progress.close();
  t.mock.timers.tick(60000);
  assert.equal(lines.length, 3);
});
