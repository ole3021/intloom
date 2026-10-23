import type { LoomView } from "@intloom/kernel";
import type { ServiceRunView } from "../core/index.ts";

export const runnable = (loom: LoomView) =>
  loom.isAvailable &&
  (!loom.readiness || loom.readiness.status === "available");
export const unfinished = (run: ServiceRunView) =>
  ["running", "waiting", "paused"].includes(run.status);
export const newest = (runs: readonly ServiceRunView[]) =>
  [...runs].sort(
    (a, b) =>
      Number(unfinished(b)) - Number(unfinished(a)) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
