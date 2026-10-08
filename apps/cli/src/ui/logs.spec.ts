import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { createLogDisplay, formatLog } from "./logs.ts";

test("stopping log display returns while terminal output is stalled", {
  timeout: 2000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-display-stop-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "events.jsonl");
  await writeFile(file, '{"level":30,"event":"step_completed"}\n');
  let onStarted = () => {};
  const started = new Promise<void>((resolve) => {
    onStarted = resolve;
  });
  let release: (() => void) | undefined;
  const error = new Writable({
    write(_chunk, _encoding, done) {
      release = done;
      onStarted();
    },
  });
  const display = createLogDisplay(error, false, false);
  const stop = display.watch(file, { level: "info" });
  await started;
  const stopped = stop();
  try {
    assert.equal(
      await Promise.race([
        stopped.then(() => true),
        setTimeout(500).then(() => false),
      ]),
      true,
    );
    assert.equal(error.destroyed, false);
    assert.equal(display.output.destroyed, false);
  } finally {
    release?.();
    await stopped;
  }
  assert.equal(display.output.listenerCount("error"), 1);
  assert.equal(display.output.listenerCount("close"), 0);
});

test("terminal summaries omit payloads and show stack locations only in debug", () => {
  const row = {
    time: "2026-10-08T06:30:15Z",
    level: 50,
    event: "step_failed",
    runId: "RUN-long",
    stageName: "specification",
    stepName: "analyze",
    err: { code: "TOOL_EXECUTION_FAILED", stack: ["tool.ts:3:2"] },
    payload: "UNNECESSARY",
  };
  const info = formatLog(row);
  assert.match(info, /specification\/analyze.*TOOL_EXECUTION_FAILED/u);
  assert.doesNotMatch(info, /RUN-long|UNNECESSARY|tool.ts/u);
  assert.match(formatLog(row, true), /tool.ts:3:2/u);
});

test("service summaries distinguish Runs and status while targeted views omit redundant Run IDs", () => {
  const base = {
    time: "2026-10-08T06:30:15Z",
    level: 50,
    event: "step_failed",
    runId: "RUN-a",
    err: { code: "LLM_REQUEST_FAILED", status: 401 },
  };
  assert.match(formatLog(base, false, true), /RUN-a.*HTTP 401/u);
  assert.match(
    formatLog(
      { ...base, runId: "RUN-b", err: { ...base.err, status: 429 } },
      false,
      true,
    ),
    /RUN-b.*HTTP 429/u,
  );
  assert.doesNotMatch(formatLog(base), /RUN-a/u);
  assert.match(
    formatLog({ ...base, event: "run_resumed", waitDurationMs: 1250 }),
    /waitMs=1250/u,
  );
  assert.match(
    formatLog({
      ...base,
      event: "model_step_completed",
      model: "example",
      inputTokens: 12,
      outputTokens: 4,
    }),
    /model=example.*in=12.*out=4/u,
  );
  assert.match(
    formatLog({
      ...base,
      event: "storage_committed",
      artifacts: [{ id: "ART-1", revision: 2 }],
      records: ["REC-1"],
    }),
    /artifact=ART-1@2.*record=REC-1/u,
  );
});

test("prompt buffering is bounded and resumes without losing the input surface", async () => {
  let text = "";
  const error = new Writable({
    write(chunk, _encoding, done) {
      text += String(chunk);
      done();
    },
  });
  const display = createLogDisplay(error, false, false);
  display.pause(true);
  for (let i = 0; i < 205; i++)
    display.output.write(
      JSON.stringify({ level: 30, event: "step_completed" }),
    );
  assert.equal(text, "");
  display.pause(false);
  assert.equal(text.match(/step completed/gu)?.length, 200);
  assert.match(text, /5 log lines remain available/u);
});
