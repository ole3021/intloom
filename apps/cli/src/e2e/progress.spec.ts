import assert from "node:assert/strict";
import { test } from "node:test";
import { E2eProgress } from "./progress.ts";

test("progress shows stages, request counts, independent checks and meaningful heartbeats", () => {
  let now = Date.parse("2026-10-23T00:00:00Z");
  const lines: string[] = [];
  const progress = new E2eProgress(
    (line) => lines.push(line),
    () => now,
  );
  const event = (kind: string, data: unknown) =>
    progress.event({
      kind,
      data,
      sequence: 1,
      at: new Date(now).toISOString(),
    });
  event("execution_started", {
    caseId: "S01",
    entry: "cmd",
    directory: "/tmp/e2e",
  });
  event("iteration_started", { index: 1, total: 1, roundId: "create" });
  event("run_progress", {
    status: "running",
    cursor: { stageName: "solution", stepName: "analyze" },
    activity: { kind: "model_request", startedAt: new Date(now).toISOString() },
    calls: { modelRequests: 18, tools: 32 },
  });
  now += 30000;
  progress.heartbeat();
  assert.match(
    lines.at(-1) ?? "",
    /heartbeat.*solution\/analyze.*model requests 18.*tools 32.*elapsed 0m30s.*activity 0m30s/u,
  );
  assert.equal(
    lines.some((line) => line.includes("iteration_started")),
    false,
  );
  const beforeRetry = lines.length;
  event("model_connection_retry", { actor: "user", attempt: 2 });
  event("model_connection_started", { actor: "user", attempt: 2 });
  assert.equal(lines.length, beforeRetry + 1);
  assert.match(lines.at(-1) ?? "", /attempt 2 \(SDK retry 1\)/u);
  event("failure", {
    code: "LLM_REQUEST_FAILED",
    message: "Transport ECONNRESET. Request failed.",
  });
  assert.match(
    lines.at(-1) ?? "",
    /round 1\/1 create.*solution\/analyze.*failed.*ECONNRESET/u,
  );
  event("checks_started", { script: "checks/test.mjs" });
  event("checks_finished", {
    script: "checks/test.mjs",
    code: 0,
    stdout: "PRIVATE_CHECK_OUTPUT",
  });
  assert.match(lines.at(-1) ?? "", /checks\/test.mjs.*passed/u);
  assert.equal(lines.join("").includes("PRIVATE_CHECK_OUTPUT"), false);
});

test("progress resets each round and does not print model contents or terminal controls", () => {
  const lines: string[] = [];
  const progress = new E2eProgress((line) => lines.push(line));
  const event = (kind: string, data: unknown) =>
    progress.event({ kind, data, sequence: 1, at: "" });
  event("iteration_started", { index: 1, total: 2, roundId: "create" });
  event("run_progress", {
    status: "waiting",
    cursor: { stageName: "specification", stepName: "resolve" },
    activity: { kind: "human_wait" },
    calls: { modelRequests: 1, tools: 1 },
    prompt: "PRIVATE_PROMPT",
  });
  assert.match(lines.at(-1) ?? "", /waiting for simulated user/u);
  event("model_final", { text: "PRIVATE_MODEL_TEXT" });
  event("iteration_started", { index: 2, total: 2, roundId: "change" });
  progress.heartbeat();
  assert.equal(lines.at(-1)?.includes("specification"), false);
  event("failure", { code: "FAIL", message: "\u001b[31mmessage\nforged line" });
  assert.equal(lines.at(-1)?.includes("\u001b"), false);
  assert.equal(lines.at(-1)?.trimEnd().includes("\n"), false);
  assert.equal(lines.join("").includes("PRIVATE_"), false);
});
