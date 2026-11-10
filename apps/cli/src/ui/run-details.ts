import type { RunActivityView, RunView } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
import { pathLine, heading } from "./theme.ts";
import { cliName } from "../metadata.ts";
import { errorBlock } from "./errors.ts";
import { activityText } from "./run-activity.ts";

export function detailText(
  { activity }: { activity: RunActivityView },
  stream: NodeJS.WriteStream = process.stdout,
  context = true,
  details = false,
) {
  const { run, artifacts } = activity;
  const project = run.location.projectDir;
  const lines = context
    ? [
        heading(stream, "Run"),
        ...(run.location.directory
          ? [pathLine("Directory", run.location.directory, stream, details)]
          : []),
        ...(project ? [pathLine("Project", project, stream, details)] : []),
        `Storage  ${run.location.storage}`,
        pathLine("Data", run.location.dataDir, stream, details),
        "",
        activityText(activity, stream),
      ]
    : [];
  for (const request of activity.interactions.filter(
    (request) => request.status === "pending",
  ))
    lines.push(
      `${request.kind === "approval" ? "Approval" : "Ask"} · ${request.message}`,
      `${cliName} interaction respond ${request.id}`,
    );
  const failure = run.error ?? run.recoveryIssue;
  if (failure) {
    const full = details || !stream.isTTY;
    lines.push("", errorBlock(failure, stream, full));
    if (!full) lines.push(`Diagnostics  ${cliName} status ${run.id}`);
  }
  for (const w of run.waits)
    if (!w.requestId)
      lines.push(
        w.childRunId
          ? `Child Run  ${cliName} status ${w.childRunId}`
          : `External wait  ${cliName} run resume ${run.id} --wait ${w.waitId} [--value <JSON>]`,
      );
  for (const f of artifacts)
    lines.push(
      `Artifact  ${f.name}   ${f.mediaType}`,
      `  ${cliName} artifact export ${f.id} --out <path>`,
    );
  return lines.join("\n");
}

export function printOutput(ctx: CommandContext, run: RunView) {
  if (run.output === undefined) return;
  if (ctx.plain || !process.stdout.isTTY) {
    ctx.output(run.output);
    return;
  }
  const referencesOnly = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (
      "kind" in value &&
      "id" in value &&
      typeof value.id === "string" &&
      Object.keys(value).length === 3 &&
      "runId" in value &&
      value.runId === run.id &&
      (value.kind === "artifact" || value.kind === "acceptance")
    )
      return true;
    const children = Object.values(value);
    return children.length > 0 && children.every(referencesOnly);
  };
  if (!ctx.values.details && referencesOnly(run.output)) return;
  const formatted = JSON.stringify(
    run.output,
    ctx.values.details
      ? undefined
      : (_key, value) => {
          if (
            value?.runId === run.id &&
            typeof value.id === "string" &&
            Object.keys(value).length === 3
          ) {
            if (value.kind === "artifact") return "See artifacts";
            if (value.kind === "acceptance") return "See acceptance result";
          }
          return value;
        },
    2,
  );
  process.stdout.write(`Output  ${formatted}\n`);
}
