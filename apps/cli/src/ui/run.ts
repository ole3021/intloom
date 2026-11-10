import type {
  RunEvent,
  RunSummary,
  QualityStatus,
  InteractionRequest,
} from "@intloom/loom-sdk";
import { formatServiceLog } from "./service-log.ts";
import { activityMark } from "./activity.ts";
import { paint } from "./theme.ts";
import { isPlainOutput } from "./output-mode.ts";

export function runMark(
  run: RunSummary,
  elapsed: number | undefined,
  stream: NodeJS.WriteStream,
  quality?: QualityStatus,
) {
  if (isPlainOutput()) return "";
  if (run.status === "running") return activityMark("working", elapsed, stream);
  if (run.status === "created")
    return activityMark("starting", elapsed, stream);
  if (run.status === "waiting" || run.status === "stopping")
    return activityMark("waiting", elapsed, stream);
  return paint(
    stream,
    run.status === "succeeded"
      ? quality === "rejected"
        ? "yellow"
        : "green"
      : run.status === "failed" || run.status === "interrupted"
        ? "red"
        : "dim",
    "▰▰▰",
  );
}

export function runLabel(
  run: RunSummary,
  quality?: QualityStatus,
  interactions: readonly InteractionRequest[] = [],
) {
  return run.status === "succeeded" && quality === "rejected"
    ? "Succeeded · Acceptance rejected"
    : waitReason(run, interactions) || statusName[run.status];
}
export const statusName: Record<RunSummary["status"], string> = {
  created: "Created",
  running: "Running",
  waiting: "Waiting",
  stopping: "Stopping",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};
export const finished = (run: RunSummary) =>
  ["succeeded", "failed", "cancelled", "interrupted"].includes(run.status);
const eventNames: Record<string, string> = {
  "run.created": "Run created",
  "run.started": "Run started",
  "run.resumed": "Run resumed",
  "run.waiting": "Run waiting",
  "run.succeeded": "Succeeded",
  "run.failed": "Failed",
  "run.stopping": "Stopping",
  "run.cancelled": "Cancelled",
  "run.interrupted": "Interrupted",
  "interaction.responded": "Response recorded",
  "interaction.requested": "Interaction requested",
  "interaction.closed": "Interaction closed",
  "validation.started": "Validating outcome",
  "validation.finished": "Outcome validation finished",
  "run.resume.requested": "Continuation requested",
  "run.recovery.changed": "Recovery status changed",
  "artifact.created": "Artifact saved",
  "acceptance.recorded": "Acceptance recorded",
  "outcome.delivered": "Delivered",
  "child.created": "Child Run created",
  "wait.accepted": "Resume request accepted",
};
export function eventLine(
  e: RunEvent,
  stream: NodeJS.WriteStream = process.stderr,
  loomId?: string,
) {
  const title =
    e.type === "interaction.responded" &&
    e.details.kind === "approval" &&
    e.details.action === "submit"
      ? e.details.approved
        ? "Approved"
        : "Rejected"
      : e.type === "interaction.requested"
        ? e.details.kind === "approval"
          ? "Approval requested"
          : "Answer requested"
        : e.type === "acceptance.recorded"
          ? `Acceptance ${e.details.status}`
          : (eventNames[e.type] ??
            (e.type === "log" ? e.details.message : undefined));
  if (typeof title !== "string") return;
  const step = Array.isArray(e.origin?.stepPath)
    ? e.origin.stepPath.join("/")
    : e.origin?.componentId;
  return formatServiceLog(
    {
      time: e.time,
      level:
        e.type === "log"
          ? String(e.details?.level ?? "info")
          : /failed|interrupted/.test(e.type)
            ? "error"
            : e.type === "acceptance.recorded" &&
                e.details.status === "rejected"
              ? "warn"
              : "info",
      runId: e.runId,
      loomId,
      componentId: typeof step === "string" ? step : undefined,
      message: title,
      data: e.type === "log" ? e.details?.data : undefined,
    },
    stream,
  );
}
export const elapsed = (run: RunSummary) =>
  Math.max(
    0,
    Math.floor(
      ((run.finishedAt ? Date.parse(run.finishedAt) : Date.now()) -
        Date.parse(run.startedAt ?? run.createdAt)) /
        1000,
    ),
  );
export function waitReason(
  run: RunSummary,
  interactions: readonly InteractionRequest[] = [],
) {
  if (run.status !== "waiting") return "";
  return run.waits
    .map((w) =>
      w.kind === "interaction"
        ? interactions.some(
            (request) =>
              request.id === w.requestId &&
              request.kind === "approval" &&
              request.status === "pending",
          )
          ? "Awaiting approval"
          : "Awaiting answer"
        : w.kind === "child"
          ? "Waiting for a child Run"
          : "Waiting for external input",
    )
    .join(", ");
}
