import { isRunSettled } from "./run-facts.ts";
import { mutate, mutateAsync } from "./mutation.ts";
import { validateLoomInput } from "./loom-input.ts";
import type { LoomInput } from "@intloom/loom-sdk";
import type { RunView } from "./run-view.ts";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { scopeSchema } from "../mirror/contracts.ts";
import { jsonCopy } from "../shared/json.ts";
import { validateResult } from "./boundaries.ts";
import { resolveCursor } from "./resolve-current-execution.ts";
import type { RunExecution } from "./execution-policy.ts";
import { ERRORS } from "../errors.ts";
import { getLogger, silentLogger } from "@intloom/utils";
import type { Runtime } from "./contracts.ts";
import { submitAnswer } from "./answer-ask.ts";
import { createRun } from "./create-run.ts";
import {
  createRunEntry,
  type RunEntry,
  notifyRunObservers,
} from "./run-entry.ts";
import { launchRunLoop } from "./run-loop.ts";
import { cancelRun } from "./cancel-run.ts";
import { toRunView } from "./to-run-view.ts";
import type { RuntimeOptions } from "./contracts.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import {
  restoreRuns,
  startRecoveredRun,
  suspendRun,
} from "./recovery/restore.ts";

/**
 * Runtime owns execution tasks; mutation admission and snapshot observation are independent.
 * The host answers by action ID or stops execution; resumption continues the original call without replaying Code from the cursor.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
  const runs = new Map<string, RunEntry>();
  const history = new Map<string, RunView>();
  const resuming = new Set<string>();
  let restored = false;
  let suspended = false;
  function assertOpen() {
    if (suspended) throw ERRORS.create("KERNEL_UNAVAILABLE");
    options.signal?.throwIfAborted();
  }
  function requireRun(runId: string): RunEntry {
    const entry = runs.get(runId);
    if (!entry)
      throw ERRORS.create("NOT_FOUND", {
        message: `Run ${runId} does not exist.`,
      });
    return entry;
  }
  async function admitRun(
    blueprint: Parameters<Runtime["startRun"]>[0],
    input: LoomInput,
    execution: RunExecution,
    startedBy: import("./contracts.ts").OperationRef | undefined,
    effect: (knownRunId?: string) => void,
  ) {
    assertOpen();
    options.mirror?.assertOpen();
    const parsedInput = validateLoomInput(blueprint, input);
    options.signal?.throwIfAborted();
    const loomIdentity = options.recovery?.loomIdentities[blueprint.loomName];
    if (options.recovery && !loomIdentity)
      throw ERRORS.create("KERNEL_UNAVAILABLE", {
        message: "Loom recovery identity is missing.",
      });
    if (
      [...runs.values()].some(
        (existing) =>
          (!isRunSettled(existing.state) ||
            existing.state.status === "paused") &&
          (options.mirror ||
            existing.state.control ||
            blueprint.exclusive ||
            existing.blueprint.exclusive),
      )
    )
      throw ERRORS.create("BUSY", {
        message: "An exclusive project Loom conflicts with another active Run.",
      });
    const entry = createRunEntry(
      blueprint,
      createRun(blueprint, parsedInput, execution),
      options.logger ?? silentLogger,
    );
    if (startedBy) entry.state.startedBy = { ...startedBy };
    if (options.mirror)
      entry.state.control = {
        traceId: randomUUID(),
        stageVisitId: 0,
        stepVisitId: 0,
        scope: { kind: "loom", completed: false },
      };
    effect(entry.state.id);
    runs.set(entry.state.id, entry);
    options.observation?.attach(entry, false, (reason) =>
      cancelRun(entry, reason),
    );
    if (options.recovery && loomIdentity) {
      entry.recovery = {
        store: options.recovery.store,
        loomIdentity,
        phase: "stage_pending",
      };
      saveCheckpoint(entry, "stage_pending");
    }
    const requestLog = getLogger();
    if (requestLog !== silentLogger && requestLog !== options.logger)
      requestLog.debug("run_requested", { runId: entry.state.id });
    entry.logger.info("run_started", { loomName: blueprint.loomName });
    const accepted = toRunView(entry.state);
    launchRunLoop(entry, options);
    return accepted;
  }
  return {
    async restore() {
      if (restored || runs.size || suspended) throw ERRORS.create("CONFLICT");
      restored = true;
      for (const saved of options.recovery?.store.read() ?? []) {
        if (saved.phase !== "terminal") continue;
        const { id, input: _input, ...run } = saved.run;
        history.set(
          id,
          structuredClone({ ...run, runId: id, historical: true }) as RunView,
        );
      }
      const entries = await restoreRuns(options);
      for (const entry of entries) {
        options.observation?.attach(entry, true, (reason) =>
          cancelRun(entry, reason),
        );
        runs.set(entry.state.id, entry);
      }
      for (const entry of entries) startRecoveredRun(entry, options);
    },
    async suspend() {
      suspended = true;
      const tasks = [...runs.values()].flatMap((entry) =>
        entry.task ? [entry.task] : [],
      );
      for (const entry of runs.values()) {
        if (
          entry.state.status !== "completed" &&
          entry.state.status !== "failed"
        )
          suspendRun(entry);
      }
      await Promise.allSettled(tasks);
      options.observation?.close();
    },
    watchRun(runId, observe) {
      const saved = history.get(runId);
      if (saved) {
        observe(structuredClone(saved));
        return () => {};
      }
      const entry = requireRun(runId);
      const listener = () => observe(toRunView(entry.state));
      entry.observers.add(listener);
      try {
        listener();
      } catch (cause) {
        entry.observers.delete(listener);
        throw cause;
      }
      return () => {
        entry.observers.delete(listener);
      };
    },
    async startRun(blueprint, input, execution, startedBy) {
      return mutateAsync((effect) =>
        admitRun(blueprint, input, execution, startedBy, effect),
      );
    },
    async resumeRun(runId, request) {
      return mutateAsync(async (effect) => {
        if (resuming.has(runId))
          throw ERRORS.create("BUSY", {
            message: "Another resume is validating this Run.",
          });
        resuming.add(runId);
        const task = Promise.resolve()
          .then(async () => {
            assertOpen();
            options.mirror?.assertOpen();
            const entry = requireRun(runId);
            if (entry.state.status !== "paused")
              throw ERRORS.create("CONFLICT", {
                message: "Only a paused Run can resume.",
              });
            if (entry.task) await entry.task;
            assertOpen();
            const view = toRunView(entry.state);
            if (
              request.serviceInstanceId !== undefined &&
              view.serviceInstanceId !== request.serviceInstanceId
            )
              throw ERRORS.create("CONFLICT", {
                message: "Service instance changed.",
              });
            if (
              request.expectedRevision !== undefined &&
              view.revision !== request.expectedRevision
            )
              throw ERRORS.create("CONFLICT", {
                message: "Run revision changed.",
              });
            const control = entry.state.control;
            if (entry.state.status === "paused" && !control) {
              if (
                request.abandonMirror ||
                (request.scope && request.scope !== "loom")
              )
                throw ERRORS.create("INVALID_REQUEST");
              validateResult(entry);
              effect();
              entry.state.status = "running";
              entry.state.updatedAt = new Date();
              saveCheckpoint(entry, entry.recovery?.phase ?? "step_result");
              notifyRunObservers(entry);
              const accepted = toRunView(entry.state);
              launchRunLoop(entry, options);
              return accepted;
            }
            if (entry.state.status !== "paused" || !control)
              throw ERRORS.create("CONFLICT", {
                message: "Only a paused mirror Run can resume.",
              });
            if (control.scope.completed && !request.scope)
              throw ERRORS.create("INVALID_REQUEST", {
                message:
                  "Scope completed; resume requires an explicit new scope.",
              });
            const kind = scopeSchema.parse(request.scope ?? control.scope.kind);
            if (
              request.abandonMirror &&
              (control.pauseReason !== "mirror_capture_failed" ||
                request.scope !== "loom")
            )
              throw ERRORS.create("INVALID_REQUEST", {
                message:
                  "Explicit abandonment requires mirror_capture_failed and an explicit loom scope; step/stage scope boundary guarantees remain enforced.",
              });
            const boundary =
              control.capturePending?.boundary.kind ?? control.boundary?.kind;
            if (
              kind === "step" &&
              boundary !== "step_before" &&
              !(
                control.pauseReason === "mirror_capture_failed" &&
                boundary === "step_after" &&
                !request.scope
              )
            )
              throw ERRORS.create("INVALID_REQUEST", {
                message:
                  "Step scope requires an actual step_before mirror; choose the next step_before image.",
              });
            if (
              kind === "stage" &&
              boundary === "stage_end" &&
              !(
                control.pauseReason === "mirror_capture_failed" &&
                !request.scope
              )
            )
              throw ERRORS.create("INVALID_REQUEST", {
                message: "Stage visit already ended.",
              });
            const current = resolveCursor(entry.blueprint, entry.state.cursor);
            const stage = entry.exitedStage
              ? undefined
              : entry.stageState.checkpoint();
            if (stage) {
              jsonCopy(stage);
              const parsed =
                "input" in stage
                  ? await current.stage.stateSchema.safeParseAsync(stage.input)
                  : undefined;
              if (
                parsed &&
                (!parsed.success ||
                  !isDeepStrictEqual(
                    jsonCopy(parsed.data),
                    jsonCopy(stage.value),
                  ))
              )
                throw ERRORS.create("CONFLICT", {
                  message:
                    "Saved Stage input no longer matches the current Schema output.",
                });
            }
            validateResult(entry);
            await options.validateExecution?.(
              entry.blueprint,
              entry.state.execution,
            );
            assertOpen();
            if (entry.state.status !== "paused")
              throw ERRORS.create("CONFLICT");
            effect();
            control.scope = {
              kind,
              completed: false,
              ...(kind === "stage"
                ? {
                    stageVisitId:
                      boundary === "loom_start"
                        ? control.stageVisitId + 1
                        : control.stageVisitId,
                  }
                : {}),
            };
            if (request.abandonMirror) {
              control.captureDisabled = true;
              delete control.capturePending;
              entry.logger.warn("mirror_capture_abandoned", {
                boundary: control.boundary?.kind,
              });
            }
            delete control.pauseReason;
            entry.state.status = "running";
            entry.state.updatedAt = new Date();
            saveCheckpoint(entry, entry.recovery?.phase ?? "stage_pending");
            notifyRunObservers(entry);
            const accepted = toRunView(entry.state);
            launchRunLoop(entry, options);
            return structuredClone(accepted);
          })
          .finally(() => resuming.delete(runId));
        return task;
      }, runId);
    },
    async findRun(startedBy) {
      const matches = (run: RunView) =>
        run.startedBy?.operationId === startedBy.operationId &&
        run.startedBy.serviceInstanceId === startedBy.serviceInstanceId;
      for (const entry of runs.values()) {
        const view = toRunView(entry.state);
        if (matches(view)) return view;
      }
      for (const view of history.values())
        if (matches(view)) return structuredClone(view);
      return undefined;
    },
    async getRun(runId) {
      const saved = history.get(runId);
      return saved
        ? structuredClone(saved)
        : toRunView(requireRun(runId).state);
    },
    async listRuns(loomName) {
      return [
        ...Array.from(runs.values())
          .filter(
            (entry) =>
              loomName === undefined || entry.state.loomName === loomName,
          )
          .map((entry) => toRunView(entry.state)),
        ...[...history.values()]
          .filter((run) => loomName === undefined || run.loomName === loomName)
          .map((run) => structuredClone(run)),
      ];
    },
    submitAnswer(runId, actionId, answer, operation) {
      return mutate((effect) => {
        assertOpen();
        return submitAnswer(
          requireRun(runId),
          actionId,
          answer,
          operation,
          effect,
        );
      }, runId);
    },
    async cancelRun(runId) {
      return mutate((effect) => {
        assertOpen();
        const entry = requireRun(runId);
        effect();
        if (
          entry.state.observation &&
          (entry.state.status === "running" || entry.state.status === "waiting")
        )
          entry.state.observation.stopReason ??= "user_cancel";
        cancelRun(entry);
        return toRunView(entry.state);
      }, runId);
    },
    async pauseRun(runId) {
      return mutate((effect) => {
        assertOpen();
        const entry = requireRun(runId);
        if (entry.state.status !== "running") throw ERRORS.create("CONFLICT");
        effect();
        entry.state.pauseRequested = true;
        entry.state.updatedAt = new Date();
        if (entry.recovery) saveCheckpoint(entry, entry.recovery.phase);
        notifyRunObservers(entry);
        return toRunView(entry.state);
      }, runId);
    },
    async cancelAllRuns() {
      if (suspended) return;
      for (const entry of runs.values()) cancelRun(entry);
    },
  };
}
