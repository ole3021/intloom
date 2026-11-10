import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { RunView, RunActivityView } from "@intloom/loom-sdk";
import { activityText } from "../src/ui/run-activity.ts";
import { activityMark, stepMark } from "../src/ui/activity.ts";
import { isPlainOutput, withPlainOutput } from "../src/ui/output-mode.ts";
import { interactive } from "../src/ui/prompts.ts";
import { paint, wrapText } from "../src/ui/theme.ts";
import { formatServiceLog } from "../src/ui/service-log.ts";
import { helpText } from "../src/ui/help.ts";
import { errorBlock } from "../src/ui/errors.ts";
import { liveOutput } from "../src/ui/live.ts";
import { runOverview as overviewLayout } from "../src/ui/overview.ts";
import { eventLine, runMark } from "../src/ui/run.ts";

function runOverview(...args: Parameters<typeof overviewLayout>) {
  return overviewLayout(...args).text;
}

function capture(tty = false) {
  let text = "";
  const stream = Object.assign(
    new Writable({
      write(chunk, _encoding, done) {
        text += chunk.toString();
        done();
      },
    }),
    { isTTY: tty, columns: 80, rows: 24 },
  ) as unknown as NodeJS.WriteStream;
  return { stream, text: () => text };
}

test("brand activity distinguishes rightward work from returning startup waits", () => {
  const { stream } = capture();
  const work = [0, 160, 320, 480].map((ms) =>
    activityMark("working", ms, stream),
  );
  assert.deepEqual(work, ["▰▱▱", "▱▰▱", "▱▱▰", "▰▱▱"]);
  const startup = [0, 700, 1400, 2100, 2800, 3500].map((ms) =>
    activityMark("starting", ms, stream),
  );
  assert.deepEqual(startup, ["▰▱▱", "▱▰▱", "▱▱▰", "▱▰▱", "▰▱▱", "▱▰▱"]);
  assert.equal(activityMark("waiting", undefined, stream), "▰▱▱");
  for (const status of [
    "running",
    "waiting",
    "succeeded",
    "failed",
    "pending",
  ] as const)
    assert.equal(stepMark(status, undefined, stream), "▰");
});

test("plain mode disables TTY presentation and prompts, preserves full log data and stays command-scoped", async () => {
  const { stream, text } = capture(true);
  stream.columns = 24;
  assert.equal(isPlainOutput(), false);
  await withPlainOutput(true, async () => {
    assert.equal(interactive(), false);
    assert.equal(paint(stream, "green", "complete"), "complete");
    assert.equal(activityMark("working", 160, stream), "");
    assert.equal(stepMark("waiting", 700, stream), "");
    const value = "a".repeat(150);
    assert.equal(wrapText(value, stream), value);
    const log = formatServiceLog(
      {
        time: "2026-11-05T00:00:00Z",
        level: "info",
        runId: "RABCDE",
        message: "Stock lookup",
        data: { value },
      },
      stream,
    );
    assert.equal(log.split("\n").length, 1);
    assert.deepEqual(JSON.parse(log.slice(log.indexOf("data=") + 5)), {
      value,
    });
    const view = liveOutput(stream);
    assert.equal(view.dynamic, false);
    view.frame(() => "first");
    view.line(log);
    view.frame("second");
    view.close();
    assert.match(text(), /^first\n.*Stock lookup.*\nsecond\n$/);
    assert.ok(!text().includes("\x1b"));
    assert.doesNotMatch(text(), /▰|▱/);
    await delay(1);
    assert.equal(isPlainOutput(), true);
  });
  assert.equal(isPlainOutput(), false);
});

test("help scopes subcommands, keeps only supported commands discoverable and wraps narrow output", () => {
  const { stream } = capture();
  const root = helpText([], stream);
  assert.doesNotMatch(root, /\p{Script=Han}/u);
  for (const text of [
    "Quick start",
    "Everyday commands",
    "dev publish",
    "startup",
    "shutdown",
    "interaction",
    "init",
  ])
    assert.ok(root.includes(text), text);
  const scoped = helpText(["artifact", "export"], stream);
  assert.match(scoped, /--overwrite/);
  assert.doesNotMatch(scoped, /artifact read/);
  assert.match(helpText(["startup"], stream), /MCP HTTP/);
  assert.doesNotMatch(
    root,
    /\bserve\b|Compatibility|deps resolve|run get|run result|run activity|run watch|run list/,
  );
  stream.columns = 44;
  assert.match(helpText([], stream), /dev build\n/);
  assert.ok(!helpText([], stream, true).includes("\x1b"));
});

test("Run overview keeps waiting Runs first and fits wrapped rows and omission hints within its budget", () => {
  const { stream } = capture();
  const runs = ["succeeded", "running", "waiting"].map(
    (status, index): RunView => ({
      location: {
        storage: "global",
        dataDir: "/tmp/intloom-fixture/looms/test",
        directory: "/tmp/intloom-fixture",
      },
      id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
      status: status as RunView["status"],
      loom: {
        id: "reviewed-report",
        version: "1.0.0",
        artifactDigest: "a".repeat(64),
      },
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
      waits: [],
      pendingInteractionIds: [],
    }),
  );
  const complete = runOverview(runs, stream);
  assert.ok(
    complete.indexOf("Needs attention") < complete.indexOf("In progress"),
  );
  assert.ok(complete.indexOf("In progress") < complete.indexOf("Finished"));
  for (const run of runs) assert.ok(complete.includes(run.id));
  assert.doesNotMatch(complete, /\p{Script=Han}/u);
  for (const columns of [24, 44, 80]) {
    stream.columns = columns;
    for (const maxLines of [0, 1, 2, 4, 8, 12, 20]) {
      const text = runOverview(runs, stream, { maxLines });
      const lines = text ? text.split("\n") : [];
      assert.ok(
        lines.length <= maxLines,
        `${columns} columns, ${maxLines} lines`,
      );
      assert.ok(lines.every((line) => line.length < columns));
    }
  }
  const fullHeight = complete.split("\n").length;
  assert.equal(runOverview(runs, stream, { maxLines: fullHeight }), complete);
  assert.match(
    eventLine({
      runId: "run",
      seq: 1,
      time: "2026-11-05T00:00:00.000Z",
      schemaVersion: 1,
      type: "log",
      details: { level: "info", message: "用户提供的原始内容" },
    }) ?? "",
    /用户提供的原始内容/,
  );
});

test("live output retains log lines, stops drawing on close and stays static in pipes", async () => {
  const plain = capture();
  let plainCalls = 0;
  const staticView = liveOutput(plain.stream);
  staticView.frame((time) => {
    plainCalls++;
    assert.equal(time, undefined);
    return "waiting";
  });
  await delay(180);
  assert.equal(plainCalls, 1);
  assert.equal(plain.text(), "waiting\n");
  staticView.close();

  const tty = capture(true);
  const view = liveOutput(tty.stream);
  let frames = 0;
  view.frame((time) => {
    frames++;
    return `working ${time}`;
  });
  view.line("persistent event");
  await delay(180);
  if (view.dynamic) assert.ok(frames > 1);
  assert.equal(tty.text().match(/persistent event/g)?.length, 1);
  view.frame("idle overview");
  view.line("idle diagnostic");
  if (view.dynamic)
    assert.ok(
      tty.text().lastIndexOf("idle overview") >
        tty.text().lastIndexOf("idle diagnostic"),
    );
  view.close();
  const closed = tty.text();
  await delay(180);
  assert.equal(tty.text(), closed);
});

test("snapshot marks distinguish activity from finished results and diagnostics retain original text", () => {
  const { stream } = capture();
  const run: RunView = {
    location: {
      storage: "global",
      dataDir: "/tmp/intloom-fixture/looms/test",
      directory: "/tmp/intloom-fixture",
    },
    id: "R8PQ2A",
    loom: { id: "report", version: "1.0.0", artifactDigest: "a".repeat(64) },
    status: "running",
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
    waits: [],
    pendingInteractionIds: [],
  };
  assert.equal(runMark(run, undefined, stream), "▰▱▱");
  for (const status of ["succeeded", "failed"] as const)
    assert.equal(runMark({ ...run, status }, 160, stream), "▰▰▰");
  const rejected = runOverview([{ ...run, status: "succeeded" }], stream, {
    activities: new Map([[run.id, activityFixture(run, "rejected")]]),
  });
  assert.match(rejected, /Acceptance rejected/);
  const block = errorBlock(
    {
      code: "EXECUTION_FAILED",
      message: "Failed to load stock",
      businessCode: "OUT_OF_STOCK",
      details: {
        stack: "Error: inventory is missing\n    at load (inventory.ts:9)",
        cause: "Error: source unavailable",
      },
    },
    stream,
  );
  assert.match(block, /Error · OUT_OF_STOCK/);
  assert.match(block, /Original error\nError: inventory is missing\n/);
  assert.match(block, /Caused by\nError: source unavailable/);
});

function activityFixture(
  run: RunView,
  quality: "rejected" | "not_requested" = "not_requested",
): RunActivityView {
  return {
    run,
    throughSeq: 10,
    coverage: "complete",
    steps: [],
    activeExecutions: [],
    recentExecutions: [],
    finishedExecutionCount: 0,
    progress: { completed: 0, active: 0 },
    interactions: [],
    artifacts: [],
    result: { runId: run.id, runStatus: run.status, quality },
    usage: {
      calls: 1,
      finishedCalls: 0,
      observedSteps: 1,
      inputTokens: { reported: 0, receipts: 1 },
      outputTokens: { reported: 0, receipts: 0 },
      costs: {},
      costsWithoutCurrency: 1,
      complete: false,
    },
  };
}

test("Activity display distinguishes reported zero, unknown costs, dynamic progress and concurrent calls", () => {
  const { stream } = capture();
  const activity = activityFixture({
    location: {
      storage: "global",
      dataDir: "/tmp/intloom-fixture/looms/test",
      directory: "/tmp/intloom-fixture",
    },
    id: "R7K2QA",
    loom: { id: "review", version: "1.0.0", artifactDigest: "a".repeat(64) },
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    waits: [],
    pendingInteractionIds: [],
  });
  const active: RunActivityView = {
    ...activity,
    activeExecutions: ["lookup", "search"].map((id) => ({
      id,
      kind: "tool",
      status: "running",
      startedAt: activity.run.createdAt,
      updatedAt: activity.run.createdAt,
      activeDurationMs: 0,
      waitingDurationMs: 0,
      history: "complete",
      origin: { componentId: id, stepPath: [id] },
    })),
  };
  const text = activityText(active, stream);
  assert.match(text, /Tool: lookup/);
  assert.match(text, /Tool: search/);
  assert.match(text, /input 0 · output unavailable/);
  assert.match(text, /Cost · unavailable/);
  assert.match(text, /receipts without currency/);
  assert.doesNotMatch(text, /\$0|0\/0|top-level steps/);
  for (const columns of [24, 44, 80, 120]) {
    stream.columns = columns;
    assert.ok(
      activityText(active, stream)
        .split("\n")
        .every((line) => line.length < columns),
    );
    for (const maxLines of [0, 2, 4, 6]) {
      const compact = activityText(active, stream, { maxLines });
      assert.ok((compact ? compact.split("\n").length : 0) <= maxLines);
      assert.doesNotMatch(compact, /Tokens|Cost/);
      if (maxLines >= 2) assert.match(compact, /Running/);
    }
  }
});

test("Run details retain the whole plan, nest calls under their Step and preserve summaries at small sizes", () => {
  const { stream } = capture();
  const now = new Date().toISOString();
  const base = activityFixture({
    location: {
      storage: "global",
      dataDir: "/tmp/intloom-fixture/looms/test",
      directory: "/tmp/intloom-fixture",
    },
    id: "RABCDE",
    loom: {
      id: "code-review",
      version: "1.2.0",
      artifactDigest: "a".repeat(64),
    },
    status: "running",
    createdAt: now,
    updatedAt: now,
    waits: [],
    pendingInteractionIds: [],
  });
  const zero = {
    running: 0,
    waiting: 0,
    failed: 0,
    succeeded: 0,
    cancelled: 0,
    incomplete: 0,
  };
  const call = {
    id: "agent",
    kind: "agent" as const,
    status: "running" as const,
    startedAt: now,
    updatedAt: now,
    activeDurationMs: 0,
    waitingDurationMs: 0,
    history: "complete" as const,
    origin: { componentId: "reviewer", stepPath: ["security"] },
  };
  const activity: RunActivityView = {
    ...base,
    steps: [
      {
        path: ["load"],
        label: "Load source",
        source: "code",
        conditional: false,
        counts: { ...zero, succeeded: 1 },
        activeDurationMs: 800,
        waitingDurationMs: 0,
      },
      {
        path: ["analyze"],
        label: "Analyze changes",
        source: "code",
        conditional: false,
        counts: { ...zero, succeeded: 1 },
        activeDurationMs: 3200,
        waitingDurationMs: 0,
      },
      {
        path: ["security"],
        label: "Security review",
        source: "agent",
        conditional: false,
        counts: { ...zero, running: 1 },
        activeDurationMs: 0,
        waitingDurationMs: 0,
      },
      {
        path: ["validate"],
        label: "Validate outcome",
        source: "code",
        conditional: false,
        counts: zero,
        activeDurationMs: 0,
        waitingDurationMs: 0,
      },
    ],
    progress: { completed: 2, active: 1, total: 4 },
    activeExecutions: [
      call,
      {
        ...call,
        id: "model",
        kind: "model",
        parentExecutionId: "agent",
        model: { slot: "reasoning", provider: "fixture", model: "fixture" },
        usage: {
          ...base.usage,
          inputTokens: { reported: 8000, receipts: 1 },
          outputTokens: { reported: 200, receipts: 1 },
        },
      },
    ],
    recentExecutions: [
      {
        ...call,
        id: "tool",
        parentExecutionId: "model",
        kind: "tool",
        status: "succeeded",
        activeDurationMs: 350,
        origin: { componentId: "search_files", stepPath: ["security"] },
      },
    ],
    finishedExecutionCount: 1,
  };
  const full = activityText(activity, stream);
  assert.match(full, /Load source +Succeeded · 0.8s/);
  assert.match(full, /Agent active/);
  assert.match(full, /Model: reasoning · Running · 8,200 tokens/);
  assert.match(full, /Tool: search_files · Succeeded/);
  assert.ok(
    full.indexOf("Security review") < full.indexOf("Tool: search_files"),
  );
  assert.ok(
    full.indexOf("Tool: search_files") < full.indexOf("Validate outcome"),
  );
  assert.match(full, /2\/4 steps · Artifacts 0/);
  const live = activityText(activity, stream, { maxLines: 14, elapsedMs: 160 });
  for (const step of activity.steps) assert.ok(live.includes(step.label));
  assert.match(live, /Tool: search_files/);
  assert.match(live, /Model: reasoning/);
  assert.match(live, /Elapsed/);
  for (const width of [24, 44, 80, 120]) {
    stream.columns = width;
    for (const height of [4, 8, 12, 20]) {
      const rendered = activityText(activity, stream, { maxLines: height });
      assert.ok(
        rendered.split("\n").length <= height,
        `${width} x ${height}: ${rendered}`,
      );
      assert.match(rendered, /Running/);
      if (height >= 8) assert.match(rendered, /Elapsed/);
      if (rendered.includes("Tool: search_files"))
        assert.match(rendered, /Security review/);
    }
  }
  stream.columns = 80;
  const failed = activityText(
    {
      ...activity,
      run: { ...activity.run, status: "failed", finishedAt: now },
      steps: activity.steps.map((step) =>
        step.path[0] === "security"
          ? { ...step, counts: { ...zero, failed: 1 } }
          : step,
      ),
    },
    stream,
  );
  assert.match(failed, /Security review +Failed/);
  assert.match(failed, /Validate outcome +Not run/);
  const [step] = activity.steps;
  assert.ok(step);
  const chinese = activityText(
    { ...activity, steps: [{ ...step, label: "加载源文件" }] },
    stream,
  );
  const row = chinese.split("\n").find((line) => line.includes("加载源文件"));
  assert.ok(row);
  assert.equal(
    [...row].reduce(
      (width, char) => width + (/[\u3400-\u9fff]/.test(char) ? 2 : 1),
      0,
    ),
    79,
  );
});

test("Run details and overviews use the same pending Approval identity", () => {
  const { stream } = capture();
  const now = new Date().toISOString();
  const run: RunView = {
    location: {
      storage: "global",
      dataDir: "/tmp/intloom-fixture/looms/test",
      directory: "/tmp/intloom-fixture",
    },
    id: "RAPPRO",
    loom: { id: "review", version: "1.0.0", artifactDigest: "a".repeat(64) },
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    waits: [
      {
        kind: "interaction",
        waitId: "wait",
        requestId: "request",
        origin: { componentId: "review" },
      },
    ],
    pendingInteractionIds: ["request"],
  };
  for (const kind of ["ask", "approval"] as const) {
    const activity: RunActivityView = {
      ...activityFixture(run),
      interactions: [
        {
          kind,
          id: "request",
          runId: run.id,
          executionId: "execution",
          origin: { componentId: "review" },
          message: "Review",
          answerSchema: {},
          responsePolicy: kind === "approval" ? "human" : "any",
          status: "pending",
          createdAt: now,
        },
      ],
    };
    const expected =
      kind === "approval" ? "Awaiting approval" : "Awaiting answer";
    assert.ok(activityText(activity, stream).includes(expected));
    assert.ok(
      runOverview([run], stream, {
        activities: new Map([[run.id, activity]]),
      }).includes(expected),
    );
  }
});
