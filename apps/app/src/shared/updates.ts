import type { RunListItem } from "./types.ts";

export interface StudioUpdate {
  current: string;
  phase:
    | "disabled"
    | "idle"
    | "checking"
    | "current"
    | "available"
    | "downloading"
    | "verifying"
    | "ready"
    | "applying"
    | "failed";
  target?: string;
  notes?: string;
  progress?: number;
  message?: string;
  result?: string;
}

export type UpdateCommand =
  | { action: "check" | "download" }
  | { action: "release" }
  | { action: "apply"; route: string };

export function blocksStudioRestart({ summary }: Pick<RunListItem, "summary">) {
  return (
    summary.status === "created" ||
    summary.status === "stopping" ||
    (summary.status === "running" && !summary.waits.length)
  );
}
