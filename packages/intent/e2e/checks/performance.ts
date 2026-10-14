import { Buffer } from "node:buffer";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
export function draftObservation(
  boundary: {
    kind: string;
    stageName?: string | undefined;
    stepName?: string | undefined;
    stepVisitId: number;
  },
  checkpoint: unknown,
) {
  if (
    boundary.kind !== "step_after" ||
    !["specification", "solution", "implementation"].includes(
      boundary.stageName ?? "",
    ) ||
    !["analyze", "design", "implement", "check"].includes(
      boundary.stepName ?? "",
    )
  )
    return undefined;
  const value = object(object(object(checkpoint).stage).value);
  if (!Array.isArray(value.changes) || !Array.isArray(value.feedbacks))
    return undefined;
  const questions = Array.isArray(value.questions) ? value.questions : [];
  return {
    stageName: boundary.stageName as string,
    stepName: boundary.stepName as string,
    stepVisitId: boundary.stepVisitId,
    draftBytes: Buffer.byteLength(JSON.stringify(value.changes)),
    changeCount: value.changes.length,
    questionCount: questions.length,
    unansweredQuestions: questions.filter(
      (q) => object(q).answer === undefined && object(q).skipped !== true,
    ).length,
    checkFeedbackCount: value.feedbacks.filter(
      (f) => object(f).source === "check",
    ).length,
    checkPassed:
      value.confirmation !== undefined ||
      object(object(checkpoint).result).outcome === "passed",
  };
}
export type DraftObservation = NonNullable<ReturnType<typeof draftObservation>>;
export function summarizePerformance(
  logs: unknown[],
  drafts: DraftObservation[],
) {
  const entries = logs.map(object);
  const stages = [
    "specification",
    "solution",
    "implementation",
    "validation",
  ].map((stageName) => {
    const events = entries.filter((e) => e.stageName === stageName);
    const agents = events.filter((e) => e.event === "agent_started");
    const requests = events.filter((e) =>
      [
        "model_step_completed",
        "model_step_failed",
        "model_step_stopped",
      ].includes(String(e.event)),
    );
    const closedTools = events.filter((e) => e.event === "agent_tools_closed");
    const submissions = closedTools.length
      ? closedTools
      : events.filter(
          (e) =>
            e.event === "tool_completed" &&
            ["submit_specification", "submit_solution"].includes(
              String(e.toolName),
            ),
        );
    const stageDrafts = drafts
      .filter((d) => d.stageName === stageName)
      .sort((a, b) => a.stepVisitId - b.stepVisitId);
    const checks = stageDrafts.filter(
      (d) => d.stepName === "check" && d.unansweredQuestions === 0,
    );
    const visits = stageDrafts.filter((d) => d.stepName !== "check");
    return {
      stageName,
      models: [
        ...new Set(
          requests
            .map((e) => e.model)
            .filter((model): model is string => typeof model === "string"),
        ),
      ],
      agentInvocations: agents.length,
      agentDurationMs: events
        .filter((e) =>
          ["agent_completed", "agent_failed"].includes(String(e.event)),
        )
        .reduce((sum, e) => sum + count(e.durationMs), 0),
      requestCount: requests.length,
      requestDurationMs: requests.reduce(
        (sum, e) => sum + count(e.durationMs),
        0,
      ),
      requestDurationsMs: requests.map((e) => count(e.durationMs)),
      outputTokens: requests.reduce((sum, e) => sum + count(e.outputTokens), 0),
      successfulSubmissions: submissions.length,
      inputRejections: events.filter((e) => e.event === "tool_input_rejected")
        .length,
      submissionAttempts: events.filter(
        (e) =>
          ["tool_completed", "tool_failed"].includes(String(e.event)) &&
          String(e.toolName).startsWith("submit_"),
      ).length,
      repeatedSuccessfulSubmissions: Math.max(
        0,
        submissions.length -
          new Set(submissions.map((e) => e.executionId)).size,
      ),
      checkAttempts: checks.length,
      checkFailures: checks.filter((d) => !d.checkPassed).length,
      firstCheckPassed: checks[0]?.checkPassed ?? null,
      peakDraftBytes: Math.max(0, ...visits.map((d) => d.draftBytes)),
      finalDraftBytes: visits.at(-1)?.draftBytes ?? null,
      drafts: stageDrafts,
    };
  });
  return {
    serviceModelTelemetryAvailable: stages.some(
      (stage) => stage.requestCount > 0,
    ),
    stages,
    limits:
      "Provider stream duration and reported output tokens come from actual host telemetry. Draft bytes measure cumulative Changes at mirror boundaries, not all model output. First-check success covers deterministic protocol/business validation, not product quality. Missing service telemetry does not imply zero client-model work.",
  };
}
export type PerformanceSummary = ReturnType<typeof summarizePerformance>;
export function performanceReport(summary: PerformanceSummary): string[] {
  return [
    "## Execution performance",
    "",
    "| Stage | Models | Requests | Stream seconds | Output tokens | First Check | Check failures | Extra successful submits | Peak draft bytes |",
    "| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
    ...summary.stages.map(
      (s) =>
        `| ${s.stageName} | ${s.models.join(", ") || "unavailable"} | ${s.requestCount} | ${(s.requestDurationMs / 1000).toFixed(1)} | ${s.outputTokens} | ${s.firstCheckPassed === null ? "not_observed" : s.firstCheckPassed ? "passed" : "failed"} | ${s.checkFailures} | ${s.repeatedSuccessfulSubmissions} | ${s.peakDraftBytes} |`,
    ),
    "",
    summary.limits,
    "",
  ];
}
