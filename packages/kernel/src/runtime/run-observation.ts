import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import * as z from "zod";
import type { StorageCommitResult } from "@intloom/loom-sdk";
import type { ServiceModelObserver } from "../effector/execution.ts";
import type { RunEntry } from "./run-entry.ts";
import type { RunState } from "./run-state.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";

const count = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const runLimitsSchema = z.strictObject({
  maxModelCalls: positive.optional(),
  maxKnownInputTokens: positive.optional(),
  maxKnownOutputTokens: positive.optional(),
  maxDurationMs: positive.max(2147483647).optional(),
});
export type RunLimits = z.infer<typeof runLimitsSchema>;
export const modelPriceSchema = z.strictObject({
  modelId: z.string().min(1).max(200),
  inputPerMillion: amount,
  outputPerMillion: amount,
  pricingId: z.string().min(1).max(200),
});
export type ModelPrice = z.infer<typeof modelPriceSchema>;
const completeness = z.enum(["complete", "partial", "unavailable"]);
export const runMetricsSchema = z.strictObject({
  scope: z.literal("service_instance"),
  serviceInstanceId: z.uuid(),
  startedAt: z.iso.datetime(),
  recovered: z.boolean(),
  timing: z.strictObject({
    elapsedMs: amount,
    executionMs: amount,
    humanWaitMs: amount,
  }),
  calls: z.strictObject({ agents: count, modelRequests: count, tools: count }),
  usage: z.strictObject({
    inputTokens: amount.optional(),
    outputTokens: amount.optional(),
    completeness,
    models: z.array(
      z.strictObject({
        modelId: z.string(),
        requests: count,
        inputTokens: amount.optional(),
        outputTokens: amount.optional(),
        completeness,
      }),
    ),
  }),
  cost: z.strictObject({
    currency: z.literal("USD"),
    estimated: z.literal(true),
    knownAmount: amount.optional(),
    completeness,
    pricingIds: z.array(z.string()),
  }),
});
export type RunMetrics = z.infer<typeof runMetricsSchema>;
export const runActivitySchema = z.strictObject({
  kind: z.enum([
    "code",
    "agent",
    "model_request",
    "tool",
    "human_wait",
    "agent_wait",
  ]),
  executionId: count,
  startedAt: z.iso.datetime(),
  id: z.string().optional(),
  agentId: z.string().optional(),
});
export type RunActivity = z.infer<typeof runActivitySchema>;
export const runResultSchema = z.strictObject({
  kind: z.enum(["artifact", "record", "removed_artifact", "removed_record"]),
  id: z.string(),
  stageName: z.string(),
  stepName: z.string(),
  executionId: count,
  committedAt: z.iso.datetime(),
  revision: positive.optional(),
});
export type RunResult = z.infer<typeof runResultSchema>;
interface ModelRequest {
  id: string;
  modelId: string;
  startedAt: string;
  inputTokens?: number;
  outputTokens?: number;
  completed: boolean;
  usageRecorded: boolean;
}
export interface RunObservationState {
  serviceInstanceId: string;
  revision: number;
  metrics: RunMetrics;
  limits: RunLimits;
  activity: RunActivity[];
  results: RunResult[];
  settled: boolean;
  stopReason?: "user_cancel" | "budget_exceeded";
  started: number;
  humanWait: number;
  pausedSince?: number;
  pausedDuration?: number;
  mirrorDuration?: number;
  mirrorStartedAt?: number;
  waitingSince?: number;
  terminalAt?: number;
  inFlight: number;
  requests: Map<string, ModelRequest>;
  toolIds: Set<string>;
  activeTools: Map<string, string>;
  prices: readonly ModelPrice[];
  activeStep?: RunActivity;
  fingerprint?: string;
  summaryLogged?: boolean;
}

/** Samples authoritative Kernel metadata; it never uses log text or client clocks. */
export function sampleRunObservation(state: RunState): void {
  const meta = state.observation;
  if (!meta) return;
  const now = performance.now();
  const terminal = state.status === "completed" || state.status === "failed";
  if (terminal) meta.terminalAt ??= now;
  if (state.status === "paused") meta.pausedSince ??= now;
  else if (meta.pausedSince !== undefined) {
    meta.pausedDuration = (meta.pausedDuration ?? 0) + now - meta.pausedSince;
    delete meta.pausedSince;
  }
  const end = meta.terminalAt ?? meta.pausedSince ?? now;
  if (state.pendingAction && !terminal) meta.waitingSince ??= now;
  else if (meta.waitingSince !== undefined) {
    meta.humanWait += Math.max(0, end - meta.waitingSince);
    delete meta.waitingSince;
  }
  const elapsed = Math.max(
    0,
    end -
      meta.started -
      (meta.pausedDuration ?? 0) -
      (meta.mirrorDuration ?? 0) -
      (meta.mirrorStartedAt === undefined
        ? 0
        : Math.max(0, end - meta.mirrorStartedAt)),
  );
  const waiting =
    meta.humanWait +
    (meta.waitingSince === undefined
      ? 0
      : Math.max(0, end - meta.waitingSince));
  const quantize = (value: number) =>
    terminal ? Math.round(value) : Math.floor(value / 1000) * 1000;
  meta.metrics.timing = {
    elapsedMs: quantize(elapsed),
    humanWaitMs: quantize(waiting),
    executionMs: quantize(Math.max(0, elapsed - waiting)),
  };
  const groups = new Map<string, ModelRequest[]>();
  for (const request of meta.requests.values()) {
    const group = groups.get(request.modelId) ?? [];
    group.push(request);
    groups.set(request.modelId, group);
  }
  const knownInput = [...meta.requests.values()].filter(
    (item) => item.inputTokens !== undefined,
  );
  const knownOutput = [...meta.requests.values()].filter(
    (item) => item.outputTokens !== undefined,
  );
  const external =
    state.execution.agentExecutor === "mcp_client" &&
    meta.metrics.calls.agents > 0;
  const complete =
    !external &&
    knownInput.length === meta.requests.size &&
    knownOutput.length === meta.requests.size;
  const sum = (items: ModelRequest[], field: "inputTokens" | "outputTokens") =>
    items.reduce((value, item) => value + (item[field] ?? 0), 0);
  meta.metrics.usage = {
    ...(knownInput.length || (!external && !meta.requests.size)
      ? { inputTokens: sum(knownInput, "inputTokens") }
      : {}),
    ...(knownOutput.length || (!external && !meta.requests.size)
      ? { outputTokens: sum(knownOutput, "outputTokens") }
      : {}),
    completeness: complete
      ? "complete"
      : knownInput.length || knownOutput.length
        ? "partial"
        : "unavailable",
    models: [...groups].map(([modelId, items]) => ({
      modelId,
      requests: items.length,
      ...(items.some((item) => item.inputTokens !== undefined)
        ? { inputTokens: sum(items, "inputTokens") }
        : {}),
      ...(items.some((item) => item.outputTokens !== undefined)
        ? { outputTokens: sum(items, "outputTokens") }
        : {}),
      completeness: items.every(
        (item) =>
          item.inputTokens !== undefined && item.outputTokens !== undefined,
      )
        ? "complete"
        : items.some(
              (item) =>
                item.inputTokens !== undefined ||
                item.outputTokens !== undefined,
            )
          ? "partial"
          : "unavailable",
    })),
  };
  let priced = 0;
  let completelyPriced = 0;
  let knownCost = 0;
  const pricingIds = new Set<string>();
  for (const request of meta.requests.values()) {
    const price = meta.prices.find((item) => item.modelId === request.modelId);
    if (
      !price ||
      (request.inputTokens === undefined && request.outputTokens === undefined)
    )
      continue;
    priced++;
    if (request.inputTokens !== undefined && request.outputTokens !== undefined)
      completelyPriced++;
    knownCost +=
      ((request.inputTokens ?? 0) * price.inputPerMillion +
        (request.outputTokens ?? 0) * price.outputPerMillion) /
      1000000;
    pricingIds.add(price.pricingId);
  }
  const allPriced = !external && completelyPriced === meta.requests.size;
  meta.metrics.cost = {
    currency: "USD",
    estimated: true,
    ...(priced || allPriced ? { knownAmount: knownCost } : {}),
    completeness: allPriced ? "complete" : priced ? "partial" : "unavailable",
    pricingIds: [...pricingIds],
  };
  meta.activity = terminal
    ? []
    : state.pendingAction
      ? [
          {
            kind: "human_wait",
            id: state.pendingAction.id,
            executionId: meta.activeStep?.executionId ?? 0,
            startedAt: state.pendingAction.createdAt,
          },
        ]
      : state.pendingAgentCall
        ? [
            {
              kind: "agent_wait",
              id: state.pendingAgentCall.id,
              agentId: state.pendingAgentCall.agentId,
              executionId: meta.activeStep?.executionId ?? 0,
              startedAt: state.pendingAgentCall.createdAt,
            },
          ]
        : [
            ...(meta.activeStep ? [meta.activeStep] : []),
            ...[...meta.requests.values()]
              .filter((item) => !item.completed)
              .map(
                (item): RunActivity => ({
                  kind: "model_request",
                  id: item.id,
                  executionId: meta.activeStep?.executionId ?? 0,
                  startedAt: item.startedAt,
                }),
              ),
            ...[...meta.activeTools].map(
              ([id, startedAt]): RunActivity => ({
                kind: "tool",
                id,
                executionId: meta.activeStep?.executionId ?? 0,
                startedAt,
              }),
            ),
          ];
  if (state.status === "paused") meta.activity = [];
  meta.settled = (terminal || state.status === "paused") && meta.inFlight === 0;
  const fingerprint = JSON.stringify({
    status: state.status,
    cursor: state.cursor,
    pendingAction: state.pendingAction,
    pendingAgentCall: state.pendingAgentCall,
    lastError: state.lastError && {
      code: state.lastError.code,
      message: state.lastError.message,
    },
    metrics: meta.metrics,
    activity: meta.activity,
    results: meta.results,
    settled: meta.settled,
    stopReason: meta.stopReason,
  });
  if (fingerprint !== meta.fingerprint) {
    meta.revision++;
    meta.fingerprint = fingerprint;
  }
}

/** Service injects this controller; all counters and metadata live on each Runtime-owned RunState. */
export function createRuntimeObservation(options: {
  serviceInstanceId: string;
  limits?: RunLimits;
  prices?: readonly ModelPrice[];
}) {
  const context = new AsyncLocalStorage<{
    entry: RunEntry;
    executionId: number;
  }>();
  const entries = new Set<RunEntry>();
  const controls = new WeakMap<RunEntry, (reason?: string) => void>();
  const timers = new Set<ReturnType<typeof setInterval>>();
  const limits = runLimitsSchema.parse(options.limits ?? {});
  function summary(meta: RunObservationState) {
    return {
      modelCalls: meta.metrics.calls.modelRequests,
      knownInputTokens: meta.metrics.usage.inputTokens ?? 0,
      knownOutputTokens: meta.metrics.usage.outputTokens ?? 0,
      usageUnknownSteps: [...meta.requests.values()].filter(
        (item) =>
          item.inputTokens === undefined || item.outputTokens === undefined,
      ).length,
      durationMs: meta.metrics.timing.executionMs,
    };
  }
  function stop(
    entry: RunEntry,
    meta: RunObservationState,
    reason: string,
    cancel: (reason?: string) => void,
  ) {
    if (entry.state.status === "completed" || entry.state.status === "failed")
      return;
    meta.stopReason = "budget_exceeded";
    entry.logger.warn("run_budget_exceeded", { reason, ...summary(meta) });
    cancel(reason);
    sampleRunObservation(entry.state);
  }
  function modelContext() {
    const binding = context.getStore();
    const meta = binding?.entry.state.observation;
    const cancel = binding && controls.get(binding.entry);
    if (!binding || !meta || !cancel)
      throw RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
        message: "Model observation requires a bound Run execution.",
      });
    return { ...binding, meta, cancel };
  }
  const observer: ServiceModelObserver = {
    beforeStep(request) {
      const { entry, meta, cancel } = modelContext();
      if (entry.state.status !== "running")
        throw RUNTIME_ERRORS.create("RUN_STOPPED");
      sampleRunObservation(entry.state);
      const id = request?.requestId ?? randomUUID();
      if (meta.requests.has(id)) return;
      const usage = meta.metrics.usage;
      const exceeded =
        limits.maxModelCalls !== undefined &&
        meta.metrics.calls.modelRequests >= limits.maxModelCalls
          ? "model_calls"
          : limits.maxKnownInputTokens !== undefined &&
              (usage.inputTokens ?? 0) >= limits.maxKnownInputTokens
            ? "known_input_tokens"
            : limits.maxKnownOutputTokens !== undefined &&
                (usage.outputTokens ?? 0) >= limits.maxKnownOutputTokens
              ? "known_output_tokens"
              : limits.maxDurationMs !== undefined &&
                  performance.now() -
                    meta.started -
                    meta.humanWait -
                    (meta.pausedDuration ?? 0) -
                    (meta.mirrorDuration ?? 0) -
                    (meta.mirrorStartedAt === undefined
                      ? 0
                      : Math.max(
                          0,
                          performance.now() - meta.mirrorStartedAt,
                        )) >=
                    limits.maxDurationMs
                ? "duration"
                : undefined;
      if (exceeded) {
        stop(entry, meta, exceeded, cancel);
        throw RUNTIME_ERRORS.create("RUN_STOPPED", {
          message: `Run stopped by execution limit (${exceeded}).`,
        });
      }
      meta.requests.set(id, {
        id,
        modelId: "unknown_model",
        startedAt: new Date().toISOString(),
        completed: false,
        usageRecorded: false,
      });
      meta.metrics.calls.modelRequests++;
      sampleRunObservation(entry.state);
    },
    afterStep(usage) {
      const { entry, meta } = modelContext();
      const request = usage.requestId
        ? meta.requests.get(usage.requestId)
        : [...meta.requests.values()].findLast((item) => !item.completed);
      if (!request || request.usageRecorded) return;
      request.usageRecorded = true;
      request.completed = true;
      if (
        usage.modelId &&
        /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(usage.modelId)
      )
        request.modelId = usage.modelId;
      if (
        usage.inputTokens !== undefined &&
        Number.isFinite(usage.inputTokens) &&
        usage.inputTokens >= 0
      )
        request.inputTokens = usage.inputTokens;
      if (
        usage.outputTokens !== undefined &&
        Number.isFinite(usage.outputTokens) &&
        usage.outputTokens >= 0
      )
        request.outputTokens = usage.outputTokens;
      sampleRunObservation(entry.state);
    },
    beforeTool(tool) {
      const { entry, meta } = modelContext();
      if (!meta.toolIds.has(tool.toolCallId)) {
        meta.toolIds.add(tool.toolCallId);
        meta.metrics.calls.tools++;
        meta.activeTools.set(tool.toolCallId, new Date().toISOString());
      }
      sampleRunObservation(entry.state);
    },
    afterTool(tool) {
      const { entry, meta } = modelContext();
      meta.activeTools.delete(tool.toolCallId);
      sampleRunObservation(entry.state);
    },
  };
  return {
    observer,
    attach(
      entry: RunEntry,
      recovered: boolean,
      cancel: (reason?: string) => void,
    ) {
      const state = entry.state;
      const meta: RunObservationState = {
        serviceInstanceId: options.serviceInstanceId,
        revision: 0,
        started: performance.now(),
        humanWait: 0,
        inFlight: 0,
        limits,
        prices: options.prices ?? [],
        requests: new Map(),
        toolIds: new Set(),
        activeTools: new Map(),
        activity: [],
        results: [],
        settled: false,
        metrics: {
          scope: "service_instance",
          serviceInstanceId: options.serviceInstanceId,
          startedAt: new Date().toISOString(),
          recovered,
          timing: { elapsedMs: 0, executionMs: 0, humanWaitMs: 0 },
          calls: { agents: 0, modelRequests: 0, tools: 0 },
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            completeness: "complete",
            models: [],
          },
          cost: {
            currency: "USD",
            estimated: true,
            knownAmount: 0,
            completeness: "complete",
            pricingIds: [],
          },
        },
      };
      state.observation = meta;
      entries.add(entry);
      controls.set(entry, cancel);
      const changed = () => sampleRunObservation(state);
      entry.observers.add(changed);
      const timer = setInterval(
        () => {
          sampleRunObservation(state);
          if (
            limits.maxDurationMs !== undefined &&
            !state.pendingAction &&
            state.status !== "completed" &&
            state.status !== "failed" &&
            state.status !== "paused" &&
            performance.now() -
              meta.started -
              meta.humanWait -
              (meta.pausedDuration ?? 0) -
              (meta.mirrorDuration ?? 0) -
              (meta.mirrorStartedAt === undefined
                ? 0
                : Math.max(0, performance.now() - meta.mirrorStartedAt)) >=
              limits.maxDurationMs
          )
            stop(entry, meta, "duration", cancel);
          if (
            meta.settled &&
            (state.status === "completed" || state.status === "failed")
          ) {
            if (!meta.summaryLogged) {
              meta.summaryLogged = true;
              entry.logger.info("run_usage_summary", summary(meta));
            }
            clearInterval(timer);
            timers.delete(timer);
            entry.observers.delete(changed);
          }
        },
        Math.min(100, limits.maxDurationMs ?? 100),
      );
      timer.unref();
      timers.add(timer);
      changed();
    },
    async execute<T>(
      entry: RunEntry,
      kind: "code" | "agent",
      agentId: string | undefined,
      operation: () => Promise<T>,
    ): Promise<T> {
      const meta = entry.state.observation;
      if (!meta) return operation();
      meta.activeStep = {
        kind,
        executionId: entry.executionCount,
        startedAt: new Date().toISOString(),
        ...(agentId ? { agentId } : {}),
      };
      if (kind === "agent") meta.metrics.calls.agents++;
      try {
        return await context.run(
          { entry, executionId: entry.executionCount },
          operation,
        );
      } finally {
        delete meta.activeStep;
        for (const item of meta.requests.values()) item.completed = true;
        meta.activeTools.clear();
        sampleRunObservation(entry.state);
      }
    },
    close() {
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      entries.clear();
    },
  };
}
export type RuntimeObservation = ReturnType<typeof createRuntimeObservation>;

/** Commit references describe actual success, including a known late commit whose caller lost ownership. */
export function recordRunCommit(
  entry: RunEntry,
  cursor: { stageName: string; stepName: string },
  executionId: number,
  result: StorageCommitResult,
) {
  const meta = entry.state.observation;
  if (!meta) return;
  const base = {
    ...cursor,
    executionId,
    committedAt: new Date().toISOString(),
  };
  for (const artifact of result.writtenArtifacts)
    meta.results.push({
      ...base,
      kind: "artifact",
      id: artifact.id,
      revision: artifact.revision,
    });
  for (const record of result.appendedRecords)
    meta.results.push({ ...base, kind: "record", id: record.id });
  for (const id of result.removedArtifactIds)
    meta.results.push({ ...base, kind: "removed_artifact", id });
  for (const id of result.removedRecordIds)
    meta.results.push({ ...base, kind: "removed_record", id });
  sampleRunObservation(entry.state);
}

export function observeExternalTool(
  entry: RunEntry,
  toolCallId: string,
): () => void {
  const meta = entry.state.observation;
  if (!meta) return () => {};
  const id = `${entry.state.pendingAgentCall?.id}:${toolCallId}`;
  if (!meta.toolIds.has(id)) {
    meta.toolIds.add(id);
    meta.metrics.calls.tools++;
  }
  meta.activeTools.set(id, new Date().toISOString());
  meta.inFlight++;
  sampleRunObservation(entry.state);
  return () => {
    meta.activeTools.delete(id);
    meta.inFlight--;
    sampleRunObservation(entry.state);
  };
}
