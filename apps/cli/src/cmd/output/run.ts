import type { RunView, LoomView } from "@intloom/kernel";
import type { ServiceStatus } from "@intloom/kernel/host";
import { presentRun } from "./run-presentation.ts";

export function renderRun(run: RunView) {
  const presentation = presentRun(run);
  const lines = [
    `${presentation.title} · ${run.loomName}`,
    `Run  ${run.runId}`,
    `Status ${run.status}`,
    `Cursor ${run.cursor.stageName} / ${run.cursor.stepName}`,
    `Execution ${run.execution.source} / ${run.execution.agentExecutor}`,
  ];
  if (run.status === "running")
    lines.push(`Inspect intloom attach ${run.runId}`);
  if (run.pendingAction) {
    lines.push(
      `Action ${run.pendingAction.id}`,
      `Resume intloom attach ${run.runId}`,
    );
  }
  lines.push(...presentation.details);
  return lines.join("\n");
}
export function renderStatus(status: ServiceStatus) {
  return [
    `Service running · ${status.projectRoot}`,
    `${status.url} · PID ${status.pid} · ${status.storage}`,
    ...(status.execution
      ? [
          `MCP Agent ${status.execution.useMcpAgent ? "client" : "service"} · service models ${status.execution.serviceConfigured ? "configured" : "not configured"} · prepared Agents ${status.execution.preparedServiceAgents}`,
        ]
      : []),
    ...(status.logError
      ? [`${status.logError.code}: ${status.logError.message}`]
      : []),
    `Looms ${status.availableLoomCount} / ${status.loomCount} available`,
    `Runs running ${status.runningRuns} · waiting ${status.waitingRuns} · paused ${status.pausedRuns ?? 0} · completed ${status.completedRuns} · failed or stopped ${status.failedRuns}`,
  ].join("\n");
}
export function renderLooms(views: readonly LoomView[]) {
  return views.length
    ? views
        .map((view) =>
          view.isAvailable
            ? `Available · ${view.loomName} (${view.packageName})${view.readiness ? ` · ${view.readiness.agentExecutor}: ${view.readiness.status}${view.readiness.error ? ` · ${view.readiness.error.message}` : ""}` : ""}`
            : `Unavailable · ${view.packageName} · ${view.phase}: ${view.error.message}`,
        )
        .join("\n")
    : "This project has no Loom dependencies.";
}
