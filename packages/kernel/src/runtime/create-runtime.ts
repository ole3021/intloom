import { resolveRunExecution } from "./execution-policy.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { getLogger, silentLogger } from "@intloom/utils";
import type { Runtime } from "./contracts.ts";
import { answerAsk, submitAnswer } from "./answer-ask.ts";
import { createRun } from "./create-run.ts";
import { createRunEntry, type RunEntry, waitUntilStable } from "./run-entry.ts";
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
 * Runtime owns execution tasks; flow waits only for a stable state, and waiting preserves the original Code call.
 * The host answers by action ID or stops execution; resumption continues the original call without replaying Code from the cursor.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
  const runs = new Map<string, RunEntry>();
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
    blueprint: Parameters<Runtime["flow"]>[0],
    intent: string,
    source: NonNullable<Parameters<Runtime["flow"]>[2]>,
    waitForStable: boolean,
  ) {
    if (suspended) throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE");
    if (typeof intent !== "string" || !intent.trim())
      throw KERNEL_ERRORS.create("INVALID_REQUEST", {
        message: "Workflow intent must be nonblank text.",
      });
    options.signal?.throwIfAborted();
    const execution = options.prepareExecution
      ? await options.prepareExecution(blueprint, source)
      : resolveRunExecution(source, false);
    options.signal?.throwIfAborted();
    if (
      [...runs.values()].some(
        (existing) =>
          (existing.state.status === "running" ||
            existing.state.status === "waiting") &&
          (blueprint.exclusive || existing.blueprint.exclusive),
      )
    )
      throw KERNEL_ERRORS.create("BUSY", {
        message:
          "An exclusive project Workflow conflicts with another active Run.",
      });
    const entry = createRunEntry(
      blueprint,
      createRun(blueprint, intent, execution),
      options.logger ?? silentLogger,
    );
    options.observation?.attach(entry, false, (reason) =>
      cancelRun(entry, reason),
    );
    if (options.recovery) {
      const workflowIdentity =
        options.recovery.workflowIdentities[blueprint.flowName];
      if (!workflowIdentity)
        throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
          message: "Workflow recovery identity is missing.",
        });
      entry.recovery = {
        store: options.recovery.store,
        workflowIdentity,
        phase: "stage_pending",
      };
      saveCheckpoint(entry, "stage_pending");
    }
    runs.set(entry.state.id, entry);
    const requestLog = getLogger();
    if (requestLog !== silentLogger && requestLog !== options.logger)
      requestLog.debug("run_requested", { runId: entry.state.id });
    entry.logger.info("run_started", { flowName: blueprint.flowName });
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
    async startFlow(blueprint, intent, source = "cli") {
      return (await admitRun(blueprint, intent, source, false)).accepted;
    },
    async flow(blueprint, intent, source = "cli") {
      const result = await admitRun(blueprint, intent, source, true);
      if (!result.stable) throw KERNEL_ERRORS.create("KERNEL_UNAVAILABLE");
      return result.stable;
    },
    async getRun(runId) {
      return toRunView(requireRun(runId).state);
    },
    async listRuns(flowName) {
      return Array.from(runs.values())
        .filter(
          (entry) =>
            flowName === undefined || entry.state.flowName === flowName,
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
