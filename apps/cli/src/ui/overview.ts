import { basename } from "node:path";
import type { RunSummary, RunActivityView } from "@intloom/loom-sdk";
import { activitySummary } from "./run-activity.ts";
import { finished, runLabel, runMark } from "./run.ts";
import { activityMark } from "./activity.ts";
import { clockTime } from "./live.ts";
import { pathLine, heading, paint, wrapText } from "./theme.ts";
import { cliName } from "../metadata.ts";
import { isPlainOutput } from "./output-mode.ts";

export function serviceHeader(
  status: string,
  dataDir: string,
  stream: NodeJS.WriteStream,
  projectDir?: string,
  details = false,
) {
  const title =
    status === "offline"
      ? `${isPlainOutput() ? "" : "○ "}Intloom service offline`
      : status === "closing"
        ? `${activityMark("waiting", undefined, stream)} Intloom service shutting down`
        : `${isPlainOutput() ? "" : "● "}Intloom service online`;
  return [
    heading(stream, "Status"),
    ...(projectDir ? [pathLine("Project", projectDir, stream, details)] : []),
    pathLine("Data", dataDir, stream, details),
    paint(
      stream,
      status === "ready" ? "green" : status === "closing" ? "yellow" : "dim",
      title.trimStart(),
    ),
  ].join("\n");
}

export function runCounts(runs: RunSummary[], total: number) {
  return `Running ${runs.filter((r) => r.status === "running").length} · Waiting ${runs.filter((r) => r.status === "waiting").length} · Total ${total}`;
}

export function runOverview(
  runs: RunSummary[],
  stream: NodeJS.WriteStream,
  options: {
    elapsed?: number | undefined;
    maxLines?: number;
    activities?: ReadonlyMap<string, RunActivityView>;
  } = {},
) {
  const groups = [
    {
      title: "Needs attention",
      color: "yellow",
      runs: runs.filter((r) => r.status === "waiting"),
    },
    {
      title: "In progress",
      color: "green",
      runs: runs.filter((r) => r.status !== "waiting" && !finished(r)),
    },
    { title: "Finished", color: "dim", runs: runs.filter(finished) },
  ] as const;
  const lines: string[] = [];
  const limit = options.maxLines ?? Infinity;
  const omitted = (count: number) =>
    wrapText(
      `\n${paint(stream, "dim", `${count} more Runs · ${cliName} status`)}`,
      stream,
    ).split("\n");
  const visibleRuns: RunSummary[] = [];
  let shown = 0;
  for (const group of groups) {
    const rows = [...group.runs].sort(
      (a, b) =>
        (b.finishedAt ?? b.updatedAt).localeCompare(
          a.finishedAt ?? a.updatedAt,
        ) || b.id.localeCompare(a.id),
    );
    let opened = false;
    for (const run of rows) {
      const activity = options.activities?.get(run.id);
      const quality = activity?.result.quality;
      const row = wrapText(
        [
          `  ${runMark(run, options.elapsed, stream, quality)} ${run.loom.id} · ${run.location.projectDir ? basename(run.location.projectDir) : "No project"} / ${run.location.storage} · ${runLabel(run, quality, activity?.interactions)}`,
          paint(
            stream,
            "dim",
            `      ${run.id} · ${activity ? activitySummary(activity) : clockTime(run.updatedAt)}`,
          ),
        ].join("\n"),
        stream,
      ).split("\n");
      const label = wrapText(
        `\n${paint(stream, group.color, `${group.title} · ${rows.length}`)}`,
        stream,
      ).split("\n");
      const remaining = runs.length - shown - 1;
      if (
        lines.length +
          row.length +
          (opened ? 0 : label.length) +
          (remaining ? omitted(remaining).length : 0) >
        limit
      )
        break;
      if (!opened) lines.push(...label);
      lines.push(...row);
      opened = true;
      shown++;
      visibleRuns.push(run);
    }
  }
  if (shown < runs.length)
    lines.push(...omitted(runs.length - shown).slice(0, limit - lines.length));
  if (!runs.length)
    lines.push(
      ...wrapText(`\n${paint(stream, "dim", "No Run history yet.")}`, stream)
        .split("\n")
        .slice(0, limit),
    );
  return { text: lines.join("\n"), visibleRuns };
}
