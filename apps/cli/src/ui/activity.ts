import { paint, terminalColors } from "./theme.ts";
import { isPlainOutput } from "./output-mode.ts";
import type { ExecutionStatus } from "@intloom/loom-sdk";

export type Activity = "working" | "waiting" | "starting";
export const animationInterval = 80;

// One brand mark: work moves right; startup waits bounce without pausing at either end.
export function activityMark(
  kind: Activity,
  elapsed: number | undefined,
  stream: NodeJS.WriteStream,
) {
  if (isPlainOutput()) return "";
  const color = kind === "working" ? "green" : "yellow";
  const step = Math.floor((elapsed ?? 0) / (kind === "working" ? 160 : 700));
  const active = kind === "starting" ? [0, 1, 2, 1][step % 4] : step % 3;
  return [0, 1, 2]
    .map((index) => {
      if (!terminalColors(stream)) return index === active ? "▰" : "▱";
      const block = paint(stream, color, "▰");
      return index === active ? block : paint(stream, "dim", block);
    })
    .join("");
}

export function stepMark(
  status: ExecutionStatus | "pending",
  elapsed: number | undefined,
  stream: NodeJS.WriteStream,
) {
  if (isPlainOutput()) return "";
  const color =
    status === "failed"
      ? "red"
      : status === "waiting" || status === "incomplete"
        ? "yellow"
        : status === "running" || status === "succeeded"
          ? "green"
          : "dim";
  const mark = paint(stream, color, "▰");
  return (status === "running" || status === "waiting") &&
    elapsed !== undefined &&
    Math.floor(elapsed / 700) % 2
    ? paint(stream, "dim", mark)
    : mark;
}
