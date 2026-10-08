import { Writable } from "node:stream";
import pc from "picocolors";
import { followLog, type LogLevel } from "@intloom/utils";

const labels: Record<number, string> = {
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

export function formatLog(
  record: Record<string, unknown>,
  debug = false,
  showRun = false,
): string {
  const date = new Date(String(record.time));
  const time = Number.isNaN(date.valueOf())
    ? "--:--:--"
    : date.toLocaleTimeString("en-GB", { hour12: false });
  const level = labels[Number(record.level)] ?? "INFO";
  const location = [record.stageName, record.stepName]
    .filter(Boolean)
    .join("/");
  const details = [
    record.toolName,
    typeof record.durationMs === "number"
      ? `${record.durationMs} ms`
      : undefined,
    record.outcome,
  ].filter((value) => value !== undefined);
  const err =
    record.err && typeof record.err === "object"
      ? (record.err as Record<string, unknown>)
      : undefined;
  if (showRun && typeof record.runId === "string")
    details.unshift(`[${record.runId.slice(-10)}]`);
  const field = (key: string, label = key) => {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number")
      details.push(`${label}=${value}`);
  };
  switch (record.event) {
    case "run_started":
      field("flowName", "flow");
      break;
    case "run_resumed":
      field("waitDurationMs", "waitMs");
      break;
    case "workflow_ready":
    case "workflow_load_failed":
      field("packageName", "package");
      field("phase");
      break;
    case "storage_opened":
      field("backend");
      break;
    case "service_ready":
      field("port");
      break;
    case "compile_failed":
      field("phase");
      break;
    case "process_failed":
      field("origin");
      break;
    case "model_step_completed":
      field("model");
      field("modelStep", "step");
      field("finishReason", "finish");
      field("inputTokens", "in");
      field("outputTokens", "out");
      break;
    case "storage_committed":
      if (Array.isArray(record.artifacts))
        for (const item of record.artifacts.slice(0, 6)) {
          if (item && typeof item === "object" && typeof item.id === "string")
            details.push(
              `artifact=${item.id}${typeof item.revision === "number" ? `@${item.revision}` : ""}`,
            );
        }
      if (Array.isArray(record.records))
        for (const id of record.records.slice(0, 6))
          if (typeof id === "string") details.push(`record=${id}`);
      field("removedCount", "removed");
      break;
  }
  if (err?.code) details.push(err.code);
  else if (record.errorCode) details.push(record.errorCode);
  if (typeof err?.status === "number") details.push(`HTTP ${err.status}`);
  if (debug && record.executionId !== undefined)
    details.push(`#${record.executionId}`);
  const event = String(record.event ?? "log").replaceAll("_", " ");
  let line = `${time} ${level.padEnd(5)} ${location ? `${location} · ` : ""}${event}${details.length ? ` · ${details.join(" · ")}` : ""}`;
  if (debug && Array.isArray(err?.stack))
    line += `\n  ${err.stack.join("\n  ")}`;
  return `${line
    .split("\n")
    .map((part) => part.replaceAll(/\p{Cc}/gu, " "))
    .join("\n")}\n`;
}

export function createLogDisplay(
  error: Writable,
  color: boolean,
  debug: boolean,
  showRun = false,
) {
  const colors = pc.createColors(color);
  let paused = false;
  const pending: string[] = [];
  let omitted = 0;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      try {
        const record = JSON.parse(String(chunk)) as Record<string, unknown>;
        const text = formatLog(record, debug, showRun);
        const line =
          Number(record.level) >= 50
            ? colors.red(text)
            : Number(record.level) === 40
              ? colors.yellow(text)
              : text;
        if (paused) {
          if (pending.length < 200) pending.push(line);
          else omitted++;
          callback();
        } else error.write(line, callback);
      } catch (cause) {
        callback(
          cause instanceof Error ? cause : new Error("Invalid log record."),
        );
      }
    },
  });
  // write callbacks report failures; keep the stream's error event from becoming uncaught.
  output.on("error", () => {});
  return {
    output,
    pause(value: boolean) {
      paused = value;
      if (!value) {
        for (const line of pending.splice(0)) error.write(line);
        if (omitted)
          error.write(
            `${omitted} log lines remain available in the log file.\n`,
          );
        omitted = 0;
      }
    },
    watch(
      filePath: string,
      options: { level: LogLevel; offset?: number; requestId?: string },
    ) {
      const controller = new AbortController();
      const task = followLog(filePath, {
        ...options,
        output,
        signal: controller.signal,
      }).catch(() => {
        error.write("Log display unavailable; inspect the log file.\n");
      });
      return async () => {
        controller.abort();
        await task;
      };
    },
  };
}
