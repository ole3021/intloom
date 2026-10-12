import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { RuntimeOptions } from "../runtime/contracts.ts";
import type { RunEntry } from "../runtime/run-entry.ts";
import { notifyRunObservers } from "../runtime/run-entry.ts";
import {
  checkpointData,
  saveCheckpoint,
} from "../runtime/recovery/checkpoint.ts";
import { applyStepResult } from "../runtime/apply-step-result.ts";
import { resolveCursor } from "../runtime/resolve-current-execution.ts";
import type { MirrorBoundary } from "./contracts.ts";

export function validateResult(entry: RunEntry): void {
  if (!entry.savedResult) return;
  const state = {
    ...entry.state,
    status: "running" as const,
    cursor: { ...entry.state.cursor },
  };
  const transition = applyStepResult(
    entry.blueprint,
    state,
    resolveCursor(entry.blueprint, state.cursor),
    entry.savedResult,
  );
  const route = {
    kind: transition.kind,
    cursor: state.cursor,
    status: state.status as "running" | "completed",
  };
  if (entry.savedRoute && !isDeepStrictEqual(entry.savedRoute, route))
    throw new Error(
      "Saved Step outcome has a different route in the current Workflow.",
    );
  entry.savedRoute = route;
}
export function pauseRun(
  entry: RunEntry,
  reason: "scope_completed" | "mirror_capture_failed",
  cause?: unknown,
): void {
  const control = entry.state.control;
  if (
    !control ||
    entry.state.status === "completed" ||
    entry.state.status === "failed"
  )
    return;
  entry.state.status = "paused";
  control.pauseReason = reason;
  if (cause !== undefined)
    control.pauseCause = cause instanceof Error ? cause.message : String(cause);
  if (reason === "scope_completed") control.scope.completed = true;
  entry.state.updatedAt = new Date();
  saveCheckpoint(entry, entry.recovery?.phase ?? "stage_pending");
  notifyRunObservers(entry);
}
export async function captureBoundary(
  entry: RunEntry,
  options: RuntimeOptions,
  kind: MirrorBoundary["kind"],
  stageName = entry.state.cursor.stageName,
): Promise<boolean> {
  const control = entry.state.control;
  if (!control || !options.mirror || control.captureDisabled) return true;
  await entry.stageState.settle();
  const boundary: MirrorBoundary = {
    kind,
    stageName,
    stageVisitId: control.stageVisitId,
    stepVisitId: control.stepVisitId,
    ...(kind === "step_before" || kind === "step_after"
      ? { stepName: entry.state.cursor.stepName }
      : {}),
  };
  if (
    !control.capturePending &&
    control.published?.traceId === control.traceId &&
    isDeepStrictEqual(control.published.boundary, boundary)
  )
    return true;
  const pending = control.capturePending ?? {
    mirrorId: randomUUID(),
    boundary,
  };
  control.capturePending = pending;
  control.boundary = pending.boundary;
  const phase =
    entry.recovery?.phase ??
    (entry.savedResult
      ? "step_result"
      : entry.stageState.access
        ? "step_ready"
        : "stage_pending");
  saveCheckpoint(entry, phase);
  const started = performance.now();
  if (entry.state.observation)
    entry.state.observation.mirrorStartedAt = started;
  try {
    await options.mirror.capture(entry, checkpointData(entry, phase), pending);
    control.published = { ...pending, traceId: control.traceId };
    delete control.capturePending;
    delete control.pauseCause;
    saveCheckpoint(entry, phase);
    return true;
  } catch (cause) {
    entry.logger.error("mirror_capture_failed", {
      err: cause,
      boundary: pending.boundary.kind,
    });
    if (entry.state.status === "completed" || entry.state.status === "failed") {
      control.pauseCause =
        cause instanceof Error ? cause.message : String(cause);
      saveCheckpoint(entry, phase);
    } else pauseRun(entry, "mirror_capture_failed", cause);
    return false;
  } finally {
    if (entry.state.observation) {
      entry.state.observation.mirrorDuration =
        (entry.state.observation.mirrorDuration ?? 0) +
        performance.now() -
        started;
      delete entry.state.observation.mirrorStartedAt;
    }
  }
}
export function scopeEnded(
  entry: RunEntry,
  boundary: "step_after" | "stage_end",
): boolean {
  const control = entry.state.control;
  if (!control) return false;
  const ended =
    boundary === "step_after"
      ? control.scope.kind === "step"
      : control.scope.kind === "stage" &&
        control.scope.stageVisitId === control.stageVisitId;
  if (!ended) return false;
  pauseRun(entry, "scope_completed");
  return entry.state.status === "paused";
}
