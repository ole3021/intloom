import type { RunView } from "@intloom/kernel";

/** Presentation only; JSON and Runtime terminal states retain the original RunView. */
export interface RunPresentation {
  readonly title: string;
  readonly details: readonly string[];
}

export function presentRun(run: RunView): RunPresentation {
  if (run.status === "waiting" && run.pendingAgentCall)
    return {
      title: "Waiting for the client Agent",
      details: [
        "Continue this task in the Agent IDE that owns the call.",
        `Agent call ${run.pendingAgentCall.id} (${run.pendingAgentCall.phase})`,
      ],
    };
  if (run.status === "failed" && run.lastError?.code === "RUN_STOPPED")
    return {
      title: "Stopped",
      details: [run.lastError.message, "Committed data is retained."],
    };
  const titles = {
    running: "Running",
    paused: "Paused",
    waiting: "Waiting for an answer",
    completed: "Completed",
    failed: "Execution failed",
  };
  return {
    title: titles[run.status],
    details:
      run.status === "paused"
        ? [
            `${run.control?.pauseReason ?? "paused"}: explicit intloom resume required.`,
            ...(run.control?.pauseCause ? [run.control.pauseCause] : []),
          ]
        : run.lastError
          ? [
              `${run.lastError.code}: ${run.lastError.message}`,
              "Failure does not undo committed data. Inspect the results before running again.",
            ]
          : [],
  };
}
