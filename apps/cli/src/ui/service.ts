import { remainingRows, lineCount } from "./layout.ts";
import type {
  RunActivityView,
  RunEvent,
  ExecutionError,
} from "@intloom/loom-sdk";
import { logPage } from "./page.ts";
import { activityMark } from "./activity.ts";
import { heading, paint, pathLine, wrapText } from "./theme.ts";
import { cliName } from "../metadata.ts";
import { activitySummary } from "./run-activity.ts";
import { finished, runMark, runLabel, eventLine } from "./run.ts";
import { diagnosticBlock, errorBlock } from "./errors.ts";
import { formatServiceLog, type ServiceLogEntry } from "./service-log.ts";
import { isPlainOutput } from "./output-mode.ts";

export function serviceDisplay(
  dataDir: string,
  animated = true,
  logPath?: string,
) {
  const stream = process.stderr;
  const ui = logPage(
    stream,
    dataDir,
    "startup",
    animated && Boolean(process.stdout.isTTY),
    logPath,
  );
  const active = new Map<string, RunActivityView>();
  let mcpUrl = "";
  let ready = false;
  let closing = false;
  let closed = false;
  function summary() {
    const runs = [...active.values()].map((activity) => activity.run);
    const frame = (elapsed?: number) => {
      const title = closed
        ? `${isPlainOutput() ? "" : "○ "}Intloom service stopped`
        : closing
          ? `${activityMark("waiting", elapsed, stream)} Shutting down`
          : ready
            ? paint(
                stream,
                "green",
                `${isPlainOutput() ? "" : "● "}Intloom service online`,
              )
            : `${activityMark("starting", elapsed, stream)} Starting Intloom service`;
      const lines = [
        heading(stream, "Intloom service"),
        pathLine("Data", dataDir, stream),
        ...(mcpUrl ? [`MCP      ${mcpUrl}`] : []),
        pathLine("Log", ui.path, stream),
        `${title.trimStart()} · Running ${runs.filter((r) => r.status === "running").length} · Waiting ${runs.filter((r) => r.status === "waiting").length}`,
      ];
      const budget = Math.min(
        6,
        remainingRows(stream, lines.join("\n"), { reserved: 8 }),
      );
      const ordered = runs.sort(
        (a, b) =>
          Number(b.status === "waiting") - Number(a.status === "waiting"),
      );
      let used = 0;
      let shown = 0;
      for (const run of ordered.slice(0, 3)) {
        const activity = active.get(run.id) as RunActivityView;
        const row = `${runMark(run, elapsed, stream)} ${run.id}  ${run.loom.id} · ${runLabel(run, activity.result.quality, activity.interactions)}\n    ${activitySummary(activity)}`;
        const height = lineCount(row, stream);
        if (used + height + 1 > budget) break;
        lines.push(row);
        used += height;
        shown++;
      }
      if (runs.length > shown)
        lines.push(
          paint(
            stream,
            "dim",
            `${runs.length - shown} more Runs · ${cliName} status`,
          ),
        );
      if (!isPlainOutput())
        lines.push(
          paint(
            stream,
            "dim",
            closed
              ? "Service stopped"
              : closing
                ? "Waiting for active Runs to settle"
                : "Ctrl+C to leave observation · intloom shutdown to stop service",
          ),
        );
      return lines.join("\n");
    };
    ui.frame(!closed && (!ready || runs.length || closing) ? frame : frame());
  }
  const log = (
    level: string,
    entry: Omit<ServiceLogEntry, "level" | "time">,
    time?: string,
  ) => {
    const record = { ...entry, level, time: time ?? new Date().toISOString() };
    ui.line((target) => formatServiceLog(record, target));
  };
  const diagnostic = (
    level: string,
    entry: {
      message: string;
      runId?: string | undefined;
      loomId?: string | undefined;
      componentId?: string | undefined;
    },
    time?: string,
  ) => {
    if (level === "error") {
      log(level, { ...entry, message: "Original diagnostic" }, time);
      ui.line((target) =>
        diagnosticBlock("Original diagnostic", entry.message, target),
      );
    } else log(level, entry, time);
  };
  summary();
  stream.on("resize", summary);
  return {
    diagnostic,
    event(event: RunEvent, loomId: string, error?: ExecutionError) {
      if (eventLine(event, stream, loomId))
        ui.line((target) => eventLine(event, target, loomId) ?? "");
      if (error) ui.line((target) => errorBlock(error, target, !target.isTTY));
    },
    retain(ids: string[]) {
      for (const id of active.keys()) if (!ids.includes(id)) active.delete(id);
      summary();
    },
    ready(url: string) {
      mcpUrl = url;
      ready = true;
      log("info", {
        message: "Intloom service ready · Accepting local requests",
      });
      summary();
    },
    stopping() {
      closing = true;
      log("info", { message: "Intloom service shutdown requested" });
      summary();
    },
    activity(activity: RunActivityView) {
      if (finished(activity.run)) active.delete(activity.run.id);
      else active.set(activity.run.id, activity);
      summary();
    },
    closed() {
      closed = true;
      log("info", { message: "Intloom service stopped" });
      summary();
    },
    close() {
      stream.off("resize", summary);
      ui.close();
      if (ui.dynamic)
        stream.write(
          `${wrapText(pathLine("Log", ui.path, stream, true), stream)}\n`,
        );
    },
  };
}
