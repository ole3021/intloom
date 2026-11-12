import type {
  ExecutionActivity,
  ExecutionKind,
  ExecutionStatus,
  JsonObject,
  LoomManifest,
  ModelUsage,
  RunActivityView,
  RunResult,
  StepActivity,
} from "@intloom/loom-sdk";
import type { ActivitySnapshot } from "../lifecycle/run-contracts.ts";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type Usage = Mutable<ModelUsage> & {
  costs: Record<string, { reported: number; receipts: number }>;
};
const emptyUsage = (): Usage => ({
  calls: 0,
  finishedCalls: 0,
  observedSteps: 0,
  inputTokens: { reported: 0, receipts: 0 },
  outputTokens: { reported: 0, receipts: 0 },
  costs: {},
  costsWithoutCurrency: 0,
  complete: false,
});
const counts = (): Record<ExecutionStatus, number> => ({
  running: 0,
  waiting: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  incomplete: 0,
});
/** Pure projection of a single database read snapshot and the Run's immutable manifest. */
export function projectRunActivity(
  snapshot: ActivitySnapshot,
  manifest: LoomManifest,
): RunActivityView {
  const { record, events, artifacts } = snapshot;
  const executions = new Map<string, Mutable<ExecutionActivity>>();
  const endedExecutions = new Map<string, ExecutionActivity>();
  const steps = new Map<
    string,
    Mutable<StepActivity> & { counts: Record<ExecutionStatus, number> }
  >();
  let dynamic = false;
  const plan = (workflowId: string, path: string[], conditional = false) => {
    for (const value of manifest.components[workflowId]?.structure ?? []) {
      const node = value as JsonObject;
      const variable = ["branch", "foreach", "dowhile", "dountil"].includes(
        String(node.kind),
      );
      if (path.length === 0 && variable) dynamic = true;
      for (const item of (node.steps ??
        (node.step ? [node.step] : [])) as JsonObject[]) {
        const stepPath = [...path, String(item.id)];
        steps.set(JSON.stringify(stepPath), {
          path: stepPath,
          label: String(
            item.description ??
              manifest.components[String(item.component)]?.description ??
              item.id,
          ),
          source: String(item.source),
          conditional: conditional || variable,
          counts: counts(),
          activeDurationMs: 0,
          waitingDurationMs: 0,
        });
        const component = manifest.components[String(item.component)];
        if (component?.kind === "workflow")
          plan(String(item.component), stepPath, conditional || variable);
      }
    }
  };
  if (manifest.entry.kind === "workflow") plan(manifest.entry.id, []);
  const invocations = new Map<
    string,
    {
      started: boolean;
      finished: boolean;
      status?: string;
      steps?: number;
      usage: Usage;
    }
  >();
  const receipts = new Set<string>();
  const usage = emptyUsage();
  let observedExecution = false,
    partial = false;
  let expectedSeq = 1;
  let validation: RunActivityView["validation"];
  for (const event of events) {
    if (event.seq !== expectedSeq) partial = true;
    expectedSeq = event.seq + 1;
    let change:
      | ({
          kind: ExecutionKind;
          history?: "unavailable" | undefined;
        } & (
          | { action: "started" | "resumed" }
          | {
              action: "waiting" | "finished";
              status: ExecutionStatus;
              durationMs?: number | undefined;
            }
        ))
      | undefined;
    switch (event.type) {
      case "workflow.started":
      case "workflow.resumed":
      case "step.started":
      case "step.resumed":
        change = {
          kind:
            event.type === "workflow.started" ||
            event.type === "workflow.resumed"
              ? "workflow"
              : "step",
          action:
            event.type === "workflow.resumed" || event.type === "step.resumed"
              ? "resumed"
              : "started",
          history: event.details?.history,
        };
        break;
      case "workflow.waiting":
      case "step.waiting":
        change = {
          kind: event.type === "workflow.waiting" ? "workflow" : "step",
          action: "waiting",
          status: "waiting",
          ...event.details,
        };
        break;
      case "agent.started":
      case "tool.started":
      case "code.started":
        change = {
          kind:
            event.type === "agent.started"
              ? "agent"
              : event.type === "tool.started"
                ? "tool"
                : "code",
          action: "started",
        };
        break;
      case "workflow.finished":
      case "step.finished":
      case "agent.finished":
      case "tool.finished":
      case "code.finished":
        change = {
          kind:
            event.type === "workflow.finished"
              ? "workflow"
              : event.type === "step.finished"
                ? "step"
                : event.type === "agent.finished"
                  ? "agent"
                  : event.type === "tool.finished"
                    ? "tool"
                    : "code",
          action: "finished",
          ...event.details,
        };
        break;
      case "model.invocation.started":
        change = { kind: "model", action: "started" };
        break;
      case "model.invocation.finished":
        change = {
          kind: "model",
          action: "finished",
          status: event.details.status,
          durationMs: event.details.durationMs,
        };
        break;
      case "run.started":
      case "run.resumed":
        observedExecution = true;
        break;
      case "validation.started":
        validation = { status: "running" };
        break;
      case "validation.finished":
        validation = event.details;
        break;
      case "model.request.updated": {
        const call = executions.get(event.details.invocationId);
        if (call && event.details.status === "received") delete call.request;
        else if (call)
          call.request = {
            attempt: event.details.attempt,
            status: event.details.status,
            time: event.time,
          };
        break;
      }
      case "run.created":
      case "run.succeeded":
      case "run.failed":
      case "run.cancelled":
      case "run.interrupted":
      case "run.waiting":
      case "run.stopping":
      case "run.recovery.changed":
      case "run.resume.requested":
      case "child.created":
      case "interaction.requested":
      case "interaction.responded":
      case "interaction.closed":
      case "wait.accepted":
      case "artifact.created":
      case "acceptance.recorded":
      case "outcome.delivered":
      case "log":
      case "model.step.finished":
        break;
      default:
        event satisfies never;
        partial = true;
        continue;
    }
    if (change?.history === "unavailable") partial = true;
    if (event.executionId && change) {
      const { kind, action } = change;
      let execution = executions.get(event.executionId);
      if (!("status" in change)) {
        if (!execution) {
          execution = {
            id: event.executionId,
            kind,
            status: "running",
            startedAt: event.time,
            updatedAt: event.time,
            activeDurationMs: 0,
            waitingDurationMs: 0,
            history:
              action === "resumed" || change.history === "unavailable"
                ? "unavailable"
                : "complete",
            ...(event.parentExecutionId
              ? { parentExecutionId: event.parentExecutionId }
              : {}),
            ...(event.origin ? { origin: event.origin } : {}),
            ...(event.type === "model.invocation.started"
              ? {
                  model: {
                    slot: event.details.slot,
                    provider: event.details.provider,
                    model: event.details.model,
                  },
                }
              : {}),
          };
          executions.set(event.executionId, execution);
        } else if (execution.status === "waiting") {
          execution.waitingDurationMs += Math.max(
            0,
            Date.parse(event.time) - Date.parse(execution.updatedAt),
          );
        }
        execution.status = "running";
      } else if (execution) {
        execution.status = change.status;
        if (change.durationMs !== undefined)
          execution.activeDurationMs += change.durationMs;
        else if (kind !== "model") execution.history = "unavailable";
      } else partial = true;
      if (execution) {
        execution.updatedAt = event.time;
        if (
          event.type === "tool.finished" &&
          event.details.summary !== undefined
        )
          execution.summary = event.details.summary;
        if (action === "finished" && kind !== "workflow" && kind !== "step") {
          endedExecutions.delete(execution.id);
          endedExecutions.set(execution.id, execution);
        }
      }
    }
    if (
      event.type !== "model.invocation.started" &&
      event.type !== "model.invocation.finished" &&
      event.type !== "model.step.finished"
    )
      continue;
    const invocation = event.details.invocationId;
    let call = invocations.get(invocation);
    if (!call) {
      call = { started: false, finished: false, usage: emptyUsage() };
      invocations.set(invocation, call);
    }
    if (event.type === "model.invocation.started") call.started = true;
    if (event.type === "model.invocation.finished") {
      call.finished = true;
      call.status = event.details.status;
      call.steps = event.details.stepCount;
    }
    if (event.type === "model.step.finished") {
      const details = event.details;
      const key = `${invocation}/${details.step}`;
      if (receipts.has(key)) continue;
      receipts.add(key);
      for (const totals of [usage, call.usage]) {
        totals.observedSteps++;
        for (const field of ["inputTokens", "outputTokens"] as const) {
          const reported = details[field];
          if (typeof reported === "number")
            totals[field] = {
              reported: totals[field].reported + reported,
              receipts: totals[field].receipts + 1,
            };
        }
        if (typeof details.reportedCost === "number") {
          if (typeof details.currency === "string") {
            const cost = totals.costs[details.currency] ?? {
              reported: 0,
              receipts: 0,
            };
            totals.costs[details.currency] = {
              reported: cost.reported + details.reportedCost,
              receipts: cost.receipts + 1,
            };
          } else totals.costsWithoutCurrency++;
        }
      }
    }
  }
  const ended = ["succeeded", "failed", "cancelled", "interrupted"].includes(
    record.view.status,
  );
  for (const execution of executions.values()) {
    // Cancelling a stable wait closes that waiting interval without inventing active work.
    if (record.view.status === "cancelled" && execution.status === "waiting") {
      execution.waitingDurationMs += Math.max(
        0,
        Date.parse(record.view.finishedAt ?? record.view.updatedAt) -
          Date.parse(execution.updatedAt),
      );
      execution.status = "cancelled";
    } else if (ended && ["running", "waiting"].includes(execution.status)) {
      execution.status = "incomplete";
      partial = true;
    }
    if (execution.history === "unavailable") partial = true;
    if (execution.kind !== "step") continue;
    const path = execution.origin?.stepPath ?? [];
    const key = JSON.stringify(path);
    let step = steps.get(key);
    if (!step) {
      step = {
        path,
        label: path.at(-1) ?? execution.origin?.componentId ?? execution.id,
        source: "unknown",
        conditional: true,
        counts: counts(),
        activeDurationMs: 0,
        waitingDurationMs: 0,
      };
      steps.set(key, step);
      partial = true;
    }
    step.counts[execution.status]++;
    step.activeDurationMs += execution.activeDurationMs;
    step.waitingDurationMs += execution.waitingDurationMs;
  }
  if (ended && validation?.status === "running") {
    validation = { status: "incomplete" };
    partial = true;
  }
  for (const [id, call] of invocations) {
    const execution = executions.get(id);
    call.usage.calls = 1;
    call.usage.finishedCalls = Number(call.finished);
    call.usage.complete =
      !partial &&
      call.started &&
      call.finished &&
      call.status === "succeeded" &&
      execution?.history === "complete" &&
      call.steps === call.usage.observedSteps &&
      call.usage.inputTokens.receipts === call.usage.observedSteps &&
      call.usage.outputTokens.receipts === call.usage.observedSteps;
    if (execution) execution.usage = call.usage;
  }
  usage.calls = invocations.size;
  usage.finishedCalls = [...invocations.values()].filter(
    (call) => call.finished,
  ).length;
  usage.complete =
    observedExecution &&
    !partial &&
    [...invocations.values()].every((call) => call.usage.complete) &&
    [...invocations.values()].reduce(
      (sum, call) => sum + (call.steps ?? 0),
      0,
    ) === usage.observedSteps &&
    usage.inputTokens.receipts === usage.observedSteps &&
    usage.outputTokens.receipts === usage.observedSteps;
  const top = [...steps.values()].filter((step) => step.path.length === 1);
  const result: Omit<RunResult, "output"> = {
    runId: record.view.id,
    runStatus: record.view.status,
    quality: "not_requested",
    ...(record.binding.outcome ? { outcome: record.binding.outcome } : {}),
    ...record.result,
    ...(record.view.error ? { error: record.view.error } : {}),
  };
  const { output: _output, ...run } = record.view;
  return {
    run,
    throughSeq: events.at(-1)?.seq ?? 0,
    coverage: partial ? "partial" : "complete",
    steps: [...steps.values()],
    progress: {
      completed: top.reduce((sum, step) => sum + step.counts.succeeded, 0),
      active: top.reduce((sum, step) => sum + step.counts.running, 0),
      ...(!dynamic && manifest.entry.kind === "workflow"
        ? { total: top.length }
        : {}),
    },
    activeExecutions: [...executions.values()].filter((execution) =>
      ["running", "waiting", "incomplete"].includes(execution.status),
    ),
    recentExecutions: [...endedExecutions.values()].slice(-20),
    finishedExecutionCount: endedExecutions.size,
    interactions: (record.interactions ?? []).map(({ request }) => request),
    artifacts,
    result,
    usage,
    ...(validation ? { validation } : {}),
  };
}
