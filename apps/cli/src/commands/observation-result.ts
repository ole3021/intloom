import type { ObservationResult } from "../operations/observe.ts";
export function observationExitCode(
  result: ObservationResult,
  mode: "execute" | "status" = "execute",
) {
  if (result.reason === "interrupted") return 130;
  if (result.reason === "timeout") return 4;
  if (mode === "status") return 0;
  if (result.reason === "waiting") return 3;
  return result.run.status === "succeeded"
    ? result.activity.result.quality === "rejected"
      ? 5
      : 0
    : 1;
}
