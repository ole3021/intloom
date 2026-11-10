import assert from "node:assert/strict";
import { test } from "node:test";
import type { RunActivityView, RunEvent } from "@intloom/loom-sdk";
import type { ServiceClient } from "../src/service/protocol.ts";
import { observeRun } from "../src/operations/observe.ts";
import { observationExitCode } from "../src/commands/observation-result.ts";

function activity(
  status: RunActivityView["run"]["status"],
  throughSeq: number,
): RunActivityView {
  return {
    run: {
      location: {
        storage: "global",
        dataDir: "/tmp/intloom-fixture/looms/test",
        directory: "/tmp/intloom-fixture",
      },
      id: "R00001",
      status,
      loom: { id: "review", version: "1.0.0", artifactDigest: "a".repeat(64) },
      createdAt: "2026-11-05T00:00:00Z",
      updatedAt: "2026-11-05T00:00:01Z",
      pendingInteractionIds: [],
      waits:
        status === "waiting"
          ? [
              {
                waitId: "external",
                kind: "external",
                origin: { componentId: "review" },
              },
            ]
          : [],
    },
    throughSeq,
    coverage: "complete",
    steps: [],
    progress: { completed: 0, active: 0 },
    activeExecutions: [],
    recentExecutions: [],
    finishedExecutionCount: 0,
    interactions: [],
    artifacts: [],
    result: { runId: "R00001", runStatus: status, quality: "not_requested" },
    usage: {
      calls: 0,
      finishedCalls: 0,
      observedSteps: 0,
      inputTokens: { reported: 0, receipts: 0 },
      outputTokens: { reported: 0, receipts: 0 },
      costs: {},
      costsWithoutCurrency: 0,
      complete: true,
    },
  };
}
const event = (
  seq: number,
  type: "run.resumed" | "run.succeeded",
): RunEvent => ({
  schemaVersion: 1,
  runId: "R00001",
  time: "2026-11-05T00:00:01Z",
  seq,
  type,
});

test("observation refreshes a waiting snapshot after another client resumes and does not skip unread events", async () => {
  let reads = 0;
  let complete = false;
  const cursor = { after: 10 };
  const seen: number[] = [];
  const frames: string[] = [];
  const client = (async (method: string, params: unknown[]) => {
    if (method === "getRunActivity")
      return complete
        ? activity("succeeded", 13)
        : activity(
            ++reads === 1 ? "waiting" : "running",
            reads === 1 ? 10 : 12,
          );
    if (method === "getRun")
      return { ...activity("succeeded", 13).run, output: "done" };
    if (method === "listRunEvents") {
      const options = params[0] as { after: number; waitMs?: number };
      if (options.waitMs !== undefined) {
        assert.equal(
          options.after,
          11,
          "wait from the consumed cursor, not the newer projection waterline",
        );
        complete = true;
        return {
          items: [event(12, "run.resumed"), event(13, "run.succeeded")],
        };
      }
      return { items: options.after === 10 ? [event(11, "run.resumed")] : [] };
    }
    throw new Error(method);
  }) as ServiceClient;
  const result = await observeRun({
    client,
    runId: "R00001",
    until: "waiting",
    cursor,
    signal: new AbortController().signal,
    activity: (value) => frames.push(value.run.status),
    events: (page) => seen.push(...page.items.map((value) => value.seq)),
  });
  assert.equal(result.reason, "terminal");
  assert.equal(result.run.status, result.activity.run.status);
  assert.equal(result.run.output, "done");
  assert.equal(observationExitCode(result), 0);
  assert.deepEqual(frames, ["running", "succeeded"]);
  assert.deepEqual(seen, [11, 12, 13]);
});

test("waiting, timeout and interruption use the observed state without a second mutable Run read", async () => {
  for (const reason of ["waiting", "timeout", "interrupted"] as const) {
    const controller = new AbortController();
    if (reason === "interrupted") controller.abort();
    let pages = 0;
    const client = (async (method: string) => {
      if (method === "getRunActivity")
        return activity(reason === "waiting" ? "waiting" : "running", 10);
      if (method === "listRunEvents") {
        pages++;
        return { items: [], nextAfter: reason === "timeout" ? 10 : undefined };
      }
      throw new Error(`Unexpected ${method}`);
    }) as ServiceClient;
    const result = await observeRun({
      client,
      runId: "R00001",
      until: "waiting",
      cursor: { after: 10 },
      signal: controller.signal,
      ...(reason === "timeout" ? { timeoutMs: 0 } : {}),
      activity: () => {},
      events: () => {},
    });
    assert.equal(result.reason, reason);
    assert.equal(result.run.status, result.activity.run.status);
    assert.equal(
      observationExitCode(result),
      { waiting: 3, timeout: 4, interrupted: 130 }[reason],
    );
    assert.equal(pages, 1);
  }
});

test("a refreshed terminal projection drains its remaining history before observation ends", async () => {
  let reads = 0;
  const seen: number[] = [];
  const client = (async (method: string, params: unknown[]) => {
    if (method === "getRunActivity")
      return ++reads === 1
        ? activity("waiting", 10)
        : activity("succeeded", 12);
    if (method === "getRun")
      return { ...activity("succeeded", 12).run, output: "done" };
    if (method === "listRunEvents") {
      const { after } = params[0] as { after: number };
      return {
        items:
          after === 10
            ? [event(11, "run.resumed")]
            : [event(12, "run.succeeded")],
      };
    }
    throw new Error(method);
  }) as ServiceClient;
  const result = await observeRun({
    client,
    runId: "R00001",
    until: "waiting",
    cursor: { after: 10 },
    signal: new AbortController().signal,
    activity: (value) => assert.equal(value.run.status, "succeeded"),
    events: (page) => seen.push(...page.items.map((value) => value.seq)),
  });
  assert.equal(result.reason, "terminal");
  assert.deepEqual(seen, [11, 12]);
});
