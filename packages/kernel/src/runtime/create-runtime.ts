import { validateLoomInput } from "./loom-input.ts";
import type { LoomInput } from "@intloom/loom-sdk";
import type { RunView } from "./run-view.ts";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { jsonCopy, scopeSchema } from "../mirror/contracts.ts";
import { validateResult } from "../mirror/runtime.ts";
import { resolveCursor } from "./resolve-current-execution.ts";
import { resolveRunExecution } from "./execution-policy.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { getLogger, silentLogger } from "@intloom/utils";
import type { Runtime } from "./contracts.ts";
import { answerAsk, submitAnswer } from "./answer-ask.ts";
import { createRun } from "./create-run.ts";
import {
  createRunEntry,
  type RunEntry,
  notifyRunObservers,
  waitUntilStable,
} from "./run-entry.ts";
import { launchRunLoop } from "./run-loop.ts";
import { cancelRun } from "./cancel-run.ts";
import { toRunView } from "./to-run-view.ts";
import type { RuntimeOptions } from "./contracts.ts";
import * as agentCalls from "./agent-call.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import {
  restoreRuns,
  startRecoveredRun,
  suspendRun,
} from "./recovery/restore.ts";

/**
 * Runtime owns execution tasks; run waits only for a stable state, and waiting preserves the original Code call.
 * The host answers by action ID or stops execution; resumption continues the original call without replaying Code from the cursor.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
  const runs = new Map<string, RunEntry>();
  const resumes = new Map<
    string,
    { identity: string; task: Promise<RunView> }
  >();
  const resuming = new Set<string>();
  let restored = false;
  let suspended = false;
  function requireRun(runId: string): RunEntry {
    const entry = runs.get(runId);
    if (!entry)
      throw KERNEL_ERRORS.create("NOT_FOUND", {
        message: `Run ${runId} does not exist.`,
      });
    return entry;
  }
  async function admitRun(
    blueprint: Parameters<Runtime["run"]>[0],
    input: LoomInput,
    source: NonNullable<Parameters<Runtime["run"]>[2]>,
    waitForStable: boolean,
  ) {
    if (suspended) throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE");
    options.mirror?.assertOpen();
    const parsedInput = validateLoomInput(blueprint, input);
    options.signal?.throwIfAborted();
    const execution = options.prepareExecution
      ? await options.prepareExecution(blueprint, source)
      : resolveRunExecution(source, false);
    options.signal?.throwIfAborted();
    if (
      [...runs.values()].some(
        (existing) =>
          ((!!options.mirror && !!existing.task) ||
            existing.state.status === "running" ||
            existing.state.status === "waiting" ||
            existing.state.status === "paused") &&
          (options.mirror ||
            existing.state.control ||
            blueprint.exclusive ||
            existing.blueprint.exclusive),
      )
    )
      throw KERNEL_ERRORS.create("BUSY", {
        message: "An exclusive project Loom conflicts with another active Run.",
      });
    const entry = createRunEntry(
      blueprint,
      createRun(blueprint, parsedInput, execution),
      options.logger ?? silentLogger,
    );
    if (options.mirror)
      entry.state.control = {
        traceId: randomUUID(),
        stageVisitId: 0,
        stepVisitId: 0,
        scope: { kind: "loom", completed: false },
      };
    options.observation?.attach(entry, false, (reason) =>
      cancelRun(entry, reason),
    );
    if (options.recovery) {
      const loomIdentity = options.recovery.loomIdentities[blueprint.loomName];
      if (!loomIdentity)
        throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
          message: "Loom recovery identity is missing.",
        });
      entry.recovery = {
        store: options.recovery.store,
        loomIdentity,
        phase: "stage_pending",
      };
      saveCheckpoint(entry, "stage_pending");
    }
    runs.set(entry.state.id, entry);
    const requestLog = getLogger();
    if (requestLog !== silentLogger && requestLog !== options.logger)
      requestLog.debug("run_requested", { runId: entry.state.id });
    entry.logger.info("run_started", { loomName: blueprint.loomName });
    const stable = waitForStable ? waitUntilStable(entry) : undefined;
    const accepted = toRunView(entry.state);
    launchRunLoop(entry, options);
    return { accepted, stable };
  }
  return {
    async restore() {
      if (restored || runs.size || suspended)
        throw KERNEL_ERRORS.create("CONFLICT");
      restored = true;
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
    async getAgentCall(request) {
      return agentCalls.getAgentCall(requireRun(request.runId), request);
    },
    async claimAgentCall(request) {
      return agentCalls.claimAgentCall(requireRun(request.runId), request);
    },
    async callAgentTool(request) {
      return agentCalls.callAgentTool(requireRun(request.runId), request);
    },
    async readAgentAsset(request) {
      return agentCalls.readAgentAsset(requireRun(request.runId), request);
    },
    async completeAgentCall(request) {
      return agentCalls.completeAgentCall(requireRun(request.runId), request);
    },
    async failAgentCall(request) {
      return agentCalls.failAgentCall(requireRun(request.runId), request);
    },
    async startRun(blueprint, input, source = "cli") {
      return (await admitRun(blueprint, input, source, false)).accepted;
    },
    async run(blueprint, input, source = "cli") {
      const result = await admitRun(blueprint, input, source, true);
      if (!result.stable) throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE");
      return result.stable;
    },
    async resumeRun(runId, request) {
      const identity = JSON.stringify({
        runId,
        operationId: request.operationId,
        scope: request.scope ?? null,
        expectedRevision: request.expectedRevision ?? null,
        serviceInstanceId: request.serviceInstanceId ?? null,
        abandonMirror: request.abandonMirror ?? false,
      });
      const known = resumes.get(request.operationId);
      if (known) {
        if (known.identity !== identity)
          throw KERNEL_ERRORS.create("CONFLICT", {
            message: "Resume operation ID is bound to different parameters.",
          });
        return structuredClone(await known.task);
      }
      if (resuming.has(runId))
        throw KERNEL_ERRORS.create("BUSY", {
          message: "Another resume is validating this Run.",
        });
      resuming.add(runId);
      const task = Promise.resolve()
        .then(async () => {
          if (suspended) throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE");
          options.mirror?.assertOpen();
          const entry = requireRun(runId);
          if (entry.task) await entry.task;
          const view = toRunView(entry.state);
          if (
            request.serviceInstanceId !== undefined &&
            view.serviceInstanceId !== request.serviceInstanceId
          )
            throw KERNEL_ERRORS.create("CONFLICT", {
              message: "Service instance changed.",
            });
          if (
            request.expectedRevision !== undefined &&
            view.revision !== request.expectedRevision
          )
            throw KERNEL_ERRORS.create("CONFLICT", {
              message: "Run revision changed.",
            });
          const control = entry.state.control;
          if (entry.state.status !== "paused" || !control)
            throw KERNEL_ERRORS.create("CONFLICT", {
              message: "Only a paused mirror Run can resume.",
            });
          if (control.scope.completed && !request.scope)
            throw KERNEL_ERRORS.create("INVALID_REQUEST", {
              message:
                "Scope completed; resume requires an explicit new scope.",
            });
          const kind = scopeSchema.parse(request.scope ?? control.scope.kind);
          if (
            request.abandonMirror &&
            (control.pauseReason !== "mirror_capture_failed" ||
              request.scope !== "loom")
          )
            throw KERNEL_ERRORS.create("INVALID_REQUEST", {
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
            throw KERNEL_ERRORS.create("INVALID_REQUEST", {
              message:
                "Step scope requires an actual step_before mirror; choose the next step_before image.",
            });
          if (
            kind === "stage" &&
            boundary === "stage_end" &&
            !(control.pauseReason === "mirror_capture_failed" && !request.scope)
          )
            throw KERNEL_ERRORS.create("INVALID_REQUEST", {
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
              throw KERNEL_ERRORS.create("CONFLICT", {
                message:
                  "Saved Stage input no longer matches the current Schema output.",
              });
          }
          validateResult(entry);
          const execution = options.prepareExecution
            ? await options.prepareExecution(
                entry.blueprint,
                entry.state.execution.source,
              )
            : entry.state.execution;
          if (
            JSON.stringify(execution) !== JSON.stringify(entry.state.execution)
          )
            throw KERNEL_ERRORS.create("CONFLICT", {
              message: "Saved execution policy changed.",
            });
          if (entry.state.status !== "paused" || suspended)
            throw KERNEL_ERRORS.create("CONFLICT");
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
      resumes.set(request.operationId, { identity, task });
      return task;
    },
    async getRun(runId) {
      return toRunView(requireRun(runId).state);
    },
    async listRuns(loomName) {
      return Array.from(runs.values())
        .filter(
          (entry) =>
            loomName === undefined || entry.state.loomName === loomName,
        )
        .map((entry) => toRunView(entry.state));
    },
    submitAnswer(runId, actionId, answer) {
      return submitAnswer(requireRun(runId), actionId, answer);
    },
    async answerAsk(runId, actionId, answer) {
      return answerAsk(requireRun(runId), actionId, answer);
    },
    async cancelRun(runId) {
      const entry = requireRun(runId);
      if (
        entry.state.observation &&
        (entry.state.status === "running" || entry.state.status === "waiting")
      )
        entry.state.observation.stopReason ??= "user_cancel";
      cancelRun(entry);
    },
    async cancelAllRuns() {
      for (const entry of runs.values()) cancelRun(entry);
    },
  };
}
