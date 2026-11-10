import type { RunActivityView, RunEvent } from "@intloom/loom-sdk";
import type { MockRun } from "./state.ts";
import { isActive } from "./run-state.ts";
export function getRunActivity(run: MockRun): RunActivityView {
  const modelCalls = run.events.filter(
    (e): e is Extract<RunEvent, { type: "model.invocation.started" }> =>
      e.type === "model.invocation.started",
  );
  const finishes = run.events.filter(
    (e) => e.type === "model.invocation.finished",
  );
  const steps = run.events.filter((e) => e.type === "model.step.finished");
  const receipts = [
    ...new Map(
      steps.map((e) => [
        JSON.stringify([e.details.invocationId, e.details.step]),
        e,
      ]),
    ).values(),
  ];
  const count = (name: "inputTokens" | "outputTokens") => ({
    reported: receipts.reduce((n, e) => n + (e.details[name] ?? 0), 0),
    receipts: receipts.filter((e) => e.details[name] !== undefined).length,
  });
  const executions = modelCalls.map<
    RunActivityView["recentExecutions"][number]
  >((e) => {
    const finish = finishes.find(
      (f) => f.details.invocationId === e.details.invocationId,
    );
    const status =
      finish?.details.status ?? (isActive(run) ? "running" : "incomplete");
    return {
      id: e.executionId,
      kind: "model" as const,
      origin: e.origin,
      model: e.details,
      status,
      startedAt: e.time,
      updatedAt: finish?.time ?? e.time,
      activeDurationMs: finish?.details.durationMs ?? 0,
      waitingDurationMs: 0,
      history: finish ? ("complete" as const) : ("unavailable" as const),
    };
  });
  const ended = executions.filter((e) => e.status !== "running");
  const complete =
    modelCalls.length > 0 &&
    modelCalls.length === finishes.length &&
    modelCalls.every((e) => {
      const finish = finishes.find(
        (f) => f.details.invocationId === e.details.invocationId,
      );
      const observed = receipts.filter(
        (r) => r.details.invocationId === e.details.invocationId,
      );
      return (
        finish?.details.status === "succeeded" &&
        finish.details.stepCount === observed.length &&
        observed.every(
          (r) =>
            r.details.inputTokens !== undefined &&
            r.details.outputTokens !== undefined,
        )
      );
    });
  const costs: Record<string, { reported: number; receipts: number }> = {};
  let costsWithoutCurrency = 0;
  for (const { details } of receipts)
    if (details.reportedCost !== undefined) {
      if (details.currency) {
        const previous = costs[details.currency];
        costs[details.currency] = {
          reported: (previous?.reported ?? 0) + details.reportedCost,
          receipts: (previous?.receipts ?? 0) + 1,
        };
      } else costsWithoutCurrency++;
    }
  return {
    run: run.summary,
    throughSeq: run.events.at(-1)?.seq ?? 0,
    coverage: "partial",
    steps: run.steps.map((label, i) => ({
      label,
      path: [String(i)],
      source: "mock",
      conditional: false,
      counts: {
        running: +(i === run.position && run.summary.status === "running"),
        waiting: +(i === run.position && run.summary.status === "waiting"),
        succeeded: +(i < run.position || run.delivered),
        failed: 0,
        cancelled: 0,
        incomplete: 0,
      },
      activeDurationMs: 0,
      waitingDurationMs: 0,
    })),
    progress: {
      completed: run.delivered ? run.steps.length : run.position,
      active: +(run.summary.status === "running"),
      total: run.steps.length,
    },
    activeExecutions: executions.filter((x) => x.status === "running"),
    recentExecutions: ended.slice(-20),
    finishedExecutionCount: ended.length,
    interactions: run.requests,
    artifacts: run.artifact ? [run.artifact] : [],
    result: {
      runId: run.summary.id,
      runStatus: run.summary.status,
      deliveryStatus: run.summary.deliveryStatus,
      ...(run.artifact
        ? {
            candidate: {
              kind: "artifact",
              id: run.artifact.id,
              runId: run.summary.id,
            },
          }
        : {}),
      quality: run.rejected
        ? "rejected"
        : run.delivered
          ? "passed"
          : "not_requested",
    },
    usage: {
      calls: executions.length,
      finishedCalls: finishes.length,
      observedSteps: receipts.length,
      inputTokens: count("inputTokens"),
      outputTokens: count("outputTokens"),
      costs,
      costsWithoutCurrency,
      complete,
    },
  };
}
