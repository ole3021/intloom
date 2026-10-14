import assert from "node:assert/strict";
import { test } from "node:test";
import { draftObservation, summarizePerformance } from "./performance.ts";

test("performance separates Check repair, extra submissions, provider time and draft bytes", () => {
  const observe = (
    stepName: string,
    stepVisitId: number,
    feedbacks: unknown[],
    confirmation?: unknown,
  ) =>
    draftObservation(
      { kind: "step_after", stageName: "solution", stepName, stepVisitId },
      {
        stage: {
          value: {
            changes: [{ target_ref: "OAPP-cli" }],
            questions: [],
            feedbacks,
            ...(confirmation ? { confirmation } : {}),
          },
        },
      },
    );
  const drafts = [
    observe("design", 2, []),
    observe("check", 3, [{ source: "check" }]),
    observe("design", 4, [{ source: "check" }]),
    observe("check", 5, [{ source: "check" }], { digest: "reviewed" }),
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  const metrics = summarizePerformance(
    [
      { stageName: "solution", event: "agent_started", executionId: 2 },
      { stageName: "solution", event: "agent_started", executionId: 4 },
      { stageName: "solution", event: "agent_completed", durationMs: 120 },
      {
        stageName: "solution",
        event: "model_step_completed",
        model: "reasoner",
        durationMs: 90,
        outputTokens: 100,
      },
      {
        stageName: "solution",
        event: "model_step_completed",
        model: "reasoner",
        durationMs: 20,
        outputTokens: 10,
      },
      ...[2, 2, 4].map((executionId) => ({
        stageName: "solution",
        event: "tool_completed",
        toolName: "submit_solution",
        executionId,
      })),
    ],
    drafts,
  ).stages.find((s) => s.stageName === "solution");
  assert.ok(metrics);
  assert.equal(metrics.requestDurationMs, 110);
  assert.equal(metrics.outputTokens, 110);
  assert.equal(metrics.agentInvocations, 2);
  assert.equal(metrics.repeatedSuccessfulSubmissions, 1);
  assert.equal(metrics.checkFailures, 1);
  assert.equal(metrics.firstCheckPassed, false);
  assert.equal(
    metrics.peakDraftBytes,
    Buffer.byteLength(JSON.stringify([{ target_ref: "OAPP-cli" }])),
  );
  assert.equal(
    summarizePerformance([], []).serviceModelTelemetryAvailable,
    false,
  );
});

test("implementation metrics distinguish rejected in-call lists from successful saves and formal repairs", () => {
  const draft = draftObservation(
    {
      kind: "step_after",
      stageName: "implementation",
      stepName: "check",
      stepVisitId: 7,
    },
    {
      stage: {
        value: {
          changes: [{ paths: [{ path: "src/index.mjs" }] }],
          feedbacks: [],
        },
      },
      result: { outcome: "passed" },
    },
  );
  assert.ok(draft);
  const stage = summarizePerformance(
    [
      { stageName: "implementation", event: "agent_started", executionId: 6 },
      {
        stageName: "implementation",
        event: "tool_completed",
        toolName: "submit_implementation",
        executionId: 6,
      },
      {
        stageName: "implementation",
        event: "tool_completed",
        toolName: "submit_implementation",
        executionId: 6,
      },
      {
        stageName: "implementation",
        event: "agent_tools_closed",
        toolName: "submit_implementation",
        executionId: 6,
      },
    ],
    [draft],
  ).stages.find((s) => s.stageName === "implementation");
  assert.ok(stage);
  assert.equal(stage.submissionAttempts, 2);
  assert.equal(stage.successfulSubmissions, 1);
  assert.equal(stage.repeatedSuccessfulSubmissions, 0);
  assert.equal(stage.firstCheckPassed, true);
  assert.equal(stage.checkFailures, 0);
});
