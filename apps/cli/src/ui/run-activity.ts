import type {
  ExecutionActivity,
  ExecutionStatus,
  ModelUsage,
  RunActivityView,
  StepActivity,
} from "@intloom/loom-sdk";
import stringWidth from "string-width";
import { elapsed, finished, runLabel, runMark } from "./run.ts";
import { stepMark } from "./activity.ts";
import { isPlainOutput } from "./output-mode.ts";
import { paint, wrapText } from "./theme.ts";
import { cliName } from "../metadata.ts";

const duration = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const active = (call: ExecutionActivity) =>
  call.status === "running" || call.status === "waiting";
const title = (value: string) => value[0]?.toUpperCase() + value.slice(1);
const pathKey = (path: readonly string[] | undefined) =>
  JSON.stringify(path ?? []);

export function activitySummary(activity: RunActivityView) {
  const { progress, artifacts } = activity;
  if (progress.total === undefined && !activity.steps.length)
    return `Artifacts ${artifacts.length}`;
  return `${progress.total === undefined ? `${progress.completed} steps completed · ${progress.active} active steps` : `${progress.completed}/${progress.total} steps`} · Artifacts ${artifacts.length}`;
}

function tokens(
  usage: ModelUsage,
  key: "inputTokens" | "outputTokens",
  compact = false,
) {
  return usage[key].receipts
    ? formatTokens(usage[key].reported, compact)
    : "unavailable";
}

function formatTokens(value: number, compact: boolean) {
  return value.toLocaleString(
    "en-US",
    compact ? { notation: "compact", maximumFractionDigits: 1 } : {},
  );
}

function stepStatus(step: StepActivity): ExecutionStatus | "pending" {
  return (
    (
      [
        "running",
        "waiting",
        "failed",
        "incomplete",
        "cancelled",
        "succeeded",
      ] as const
    ).find((status) => step.counts[status]) ?? "pending"
  );
}

/** Presentation only: execution identities, ownership and totals come from the Intloom service. */
export function activityText(
  activity: RunActivityView,
  stream: NodeJS.WriteStream,
  options: { elapsedMs?: number | undefined; maxLines?: number } = {},
) {
  const { run, result, usage } = activity;
  const plain = isPlainOutput();
  const width = Math.max(1, (stream.columns || 80) - 1);
  const compact = !plain && width < 65;
  const wrap = (text: string) => wrapText(text, stream).split("\n");
  const columns = (left: string, right: string) => {
    const gap = width - stringWidth(left) - stringWidth(right);
    return !plain && gap >= 2
      ? `${left}${" ".repeat(gap)}${right}`
      : `${left} · ${right}`;
  };
  const label = runLabel(run, result.quality, activity.interactions);
  const seconds = elapsed(run);
  const clock = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const header = wrap(
    [
      columns(
        `${cliName} run ${run.loom.id}`,
        `${runMark(run, options.elapsedMs, stream, result.quality)} ${paint(stream, "bold", label)}`.trimStart(),
      ),
      paint(
        stream,
        "dim",
        `Run ${run.id} · ${run.loom.id}@${run.loom.version}`,
      ),
    ].join("\n"),
  );
  const footer = wrap(`Elapsed ${clock} · ${activitySummary(activity)}`);
  const calls = [
    ...activity.activeExecutions,
    ...activity.recentExecutions,
  ].filter((call) => call.kind !== "step" && call.kind !== "workflow");
  const rows: {
    lines: string[];
    priority: number;
    kind: "step" | "call" | "info";
    parent?: number;
  }[] = [];
  const add = (
    text: string,
    priority: number,
    kind: "step" | "call" | "info",
    parent?: number,
  ) => {
    rows.push({
      lines: wrap(text),
      priority,
      kind,
      ...(parent === undefined ? {} : { parent }),
    });
  };
  const callRow = (
    call: ExecutionActivity,
    indent: string,
    parent?: number,
  ) => {
    const name = call.model
      ? call.model.slot
      : (call.origin?.componentId ?? call.id);
    const current =
      call.status === "running"
        ? Math.max(0, Date.now() - Date.parse(call.updatedAt))
        : 0;
    const details = call.usage
      ? `${title(call.status)} · ${
          call.usage.inputTokens.receipts && call.usage.outputTokens.receipts
            ? `${formatTokens(call.usage.inputTokens.reported + call.usage.outputTokens.reported, compact)} tokens`
            : `input ${tokens(call.usage, "inputTokens", compact)} · output ${tokens(call.usage, "outputTokens", compact)} tokens`
        }${call.usage.complete ? "" : " · partial / pending"}`
      : `${title(call.status)}${call.activeDurationMs || current ? ` · ${duration(call.activeDurationMs + current)}` : ""}`;
    add(
      wrapText(
        `${plain ? "" : "↳ "}${title(call.kind)}: ${name}${call.summary ? ` · ${call.summary}` : ""} · ${details}`,
        {
          columns: Math.max(2, (stream.columns || 80) - indent.length),
        } as NodeJS.WriteStream,
      )
        .split("\n")
        .map((line) => indent + line)
        .join("\n"),
      active(call) || call.status === "incomplete" ? 2 : 3,
      "call",
      parent,
    );
  };
  for (const step of activity.steps) {
    const owned = calls.filter(
      (call) => pathKey(call.origin?.stepPath) === pathKey(step.path),
    );
    const status = stepStatus(step);
    const running =
      owned.find((call) => call.kind === "agent" && active(call)) ??
      owned.find(active);
    const states = Object.entries(step.counts).filter(([, count]) => count > 0);
    let state =
      states.length > 1 || states.some(([, count]) => count > 1)
        ? states
            .map(
              ([name, count]) =>
                `${title(name)}${count > 1 ? ` ×${count}` : ""}`,
            )
            .join(" · ")
        : status === "pending"
          ? step.conditional
            ? "Conditional"
            : finished(run)
              ? "Not run"
              : "Pending"
          : status === "running" && running
            ? `${title(running.kind)} active`
            : title(status);
    const open = activity.activeExecutions.filter(
      (call) =>
        call.kind === "step" &&
        pathKey(call.origin?.stepPath) === pathKey(step.path),
    );
    const activeMs =
      step.activeDurationMs +
      open
        .filter((call) => call.status === "running")
        .reduce(
          (sum, call) =>
            sum + Math.max(0, Date.now() - Date.parse(call.updatedAt)),
          0,
        );
    const waitingMs =
      step.waitingDurationMs +
      open
        .filter((call) => call.status === "waiting")
        .reduce(
          (sum, call) =>
            sum + Math.max(0, Date.now() - Date.parse(call.updatedAt)),
          0,
        );
    if (activeMs || status === "succeeded") state += ` · ${duration(activeMs)}`;
    if (waitingMs) state += ` · ${duration(waitingMs)} waiting`;
    const indent = "  ".repeat(Math.max(0, step.path.length - 1));
    const parent = rows.length;
    add(
      columns(
        `${indent}${stepMark(status, options.elapsedMs, stream)} ${step.label}`.trimEnd(),
        paint(
          stream,
          status === "running" ? "cyan" : status === "failed" ? "red" : "dim",
          state,
        ),
      ),
      ["running", "waiting", "failed", "incomplete"].includes(status) ? 0 : 1,
      "step",
    );
    // Agent/Code status is already on the owning Step. Tools and model receipts add detail.
    for (const call of owned.filter(
      (call) => call.kind === "tool" || call.kind === "model",
    ))
      callRow(call, `${indent}  `, parent);
  }
  const paths = new Set(activity.steps.map((step) => pathKey(step.path)));
  for (const call of calls.filter(
    (call) => !paths.has(pathKey(call.origin?.stepPath)),
  ))
    callRow(call, "  ");
  const omittedCalls =
    activity.finishedExecutionCount - activity.recentExecutions.length;
  if (omittedCalls > 0)
    add(
      `${omittedCalls} earlier calls · ${cliName} run events ${run.id}`,
      4,
      "info",
    );
  if (activity.validation)
    add(
      `Validation · ${title(activity.validation.status)}${activity.validation.durationMs === undefined ? "" : ` · ${duration(activity.validation.durationMs)}`}`,
      activity.validation.status === "failed" ? 0 : 4,
      "info",
    );
  if (usage.calls) {
    add(
      `Tokens · input ${tokens(usage, "inputTokens", compact)} · output ${tokens(usage, "outputTokens", compact)} · ${usage.complete ? "reported" : "partial / pending"}`,
      4,
      "info",
    );
    const costs = Object.entries(usage.costs).map(
      ([currency, cost]) => `${cost.reported} ${currency}`,
    );
    add(
      `Cost · ${costs.length ? `${costs.join(" · ")} reported` : "unavailable"}${usage.costsWithoutCurrency ? ` · ${usage.costsWithoutCurrency} receipts without currency` : ""}`,
      4,
      "info",
    );
  }
  if (finished(run))
    add(
      `Acceptance · ${result.quality.replaceAll("_", " ")}${result.quality === "rejected" ? " · execution completed; delivery rejected" : ""}`,
      0,
      "info",
    );
  if (activity.coverage === "partial")
    add(
      "History incomplete · some execution boundaries are unavailable",
      0,
      "info",
    );
  const divider = plain
    ? ""
    : paint(stream, "dim", "─".repeat(Math.min(width, 100)));
  const full = [
    ...header,
    divider,
    ...rows.flatMap((row) => row.lines),
    divider,
    ...footer,
  ];
  if (options.maxLines === undefined || full.length <= options.maxLines)
    return full.join("\n");

  // Keep complete rows, including their owning Step. The footer never scrolls out of the live panel.
  const budget = Math.max(0, options.maxLines);
  if (budget < header.length + footer.length + 1)
    return [...wrap(`${label} · ${run.id}`), ...footer]
      .slice(0, budget)
      .join("\n");
  const selected = new Set<number>();
  const hidden = () => {
    const remaining = rows.filter((_, index) => !selected.has(index));
    return wrap(
      `… ${remaining.filter((row) => row.kind === "step").length} steps · ${remaining.filter((row) => row.kind === "call").length} calls · ${remaining.filter((row) => row.kind === "info").length} details hidden`,
    );
  };
  let used = header.length + footer.length;
  for (const { row, index } of rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.priority - b.row.priority)) {
    if (row.parent !== undefined && !selected.has(row.parent)) continue;
    selected.add(index);
    if (
      used +
        row.lines.length +
        (selected.size < rows.length ? hidden().length : 0) <=
      budget
    )
      used += row.lines.length;
    else selected.delete(index);
  }
  return [
    ...header,
    ...rows.flatMap((row, index) => (selected.has(index) ? row.lines : [])),
    ...(selected.size < rows.length ? hidden() : []),
    ...footer,
  ].join("\n");
}
