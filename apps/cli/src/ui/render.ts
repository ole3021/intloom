import type { RunView, WorkflowView } from "@intloom/kernel";
import type { ServiceStatus } from "../service/contracts.ts";
import type { ProjectDiagnosis } from "../service/recovery.ts";
import { presentRun } from "./run-presentation.ts";

export function renderRun(run: RunView) {
  const presentation = presentRun(run);
  const lines = [
    `${presentation.title} · ${run.flowName}`,
    `Run  ${run.runId}`,
    `Cursor ${run.cursor.stageName} / ${run.cursor.stepName}`,
    `Execution ${run.execution.source} / ${run.execution.agentExecutor}`,
  ];
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
    `Workflows ${status.availableWorkflowCount} / ${status.workflowCount} available`,
    `Runs running ${status.runningRuns} · waiting ${status.waitingRuns} · completed ${status.completedRuns} · failed or stopped ${status.failedRuns}`,
  ].join("\n");
}
export function renderDiagnosis(diagnosis: ProjectDiagnosis) {
  if (diagnosis.service) return renderStatus(diagnosis.service);
  const labels = {
    alive: "Process still exists",
    absent: "Process has exited",
    unknown: "Unknown",
  };
  return [
    diagnosis.message,
    ...diagnosis.owners.map(
      (owner) =>
        `${owner.resource} · PID ${owner.pid} · ${labels[owner.status]}`,
    ),
    ...(diagnosis.status === "blocked"
      ? [
          "Run intloom doctor. Do not delete locks whose owners are still active.",
        ]
      : []),
  ].join("\n");
}
export function renderWorkflows(views: readonly WorkflowView[]) {
  return views.length
    ? views
        .map((view) =>
          view.isAvailable
            ? `Available · ${view.flowName} (${view.packageName})${view.readiness ? ` · ${view.readiness.agentExecutor}: ${view.readiness.status}${view.readiness.error ? ` · ${view.readiness.error.message}` : ""}` : ""}`
            : `Unavailable · ${view.packageName} · ${view.phase}: ${view.error.message}`,
        )
        .join("\n")
    : "This project has no Workflow dependencies.";
}
