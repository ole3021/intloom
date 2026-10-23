import { stripVTControlCharacters } from "node:util";
import type { EvidenceEvent } from "./evidence.ts";
import type { Run } from "./contracts.ts";

/** Compact public Run observations; omit prompts, answers and formal results. */
export function runProgress(run: Run): Record<string, unknown> {
  const activity = run.activity?.at(-1);
  return {
    runId: run.runId,
    status: run.status,
    cursor: run.cursor,
    ...(activity ? { activity } : {}),
    ...(run.metrics ? { calls: run.metrics.calls } : {}),
    settled: run.settled,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function label(value: unknown, fallback = "unknown"): string {
  return typeof value === "string"
    ? stripVTControlCharacters(value)
        .replace(/\p{Cc}/gu, " ")
        .slice(0, 300)
    : fallback;
}
function count(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? String(value)
    : "?";
}
function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

export class E2eProgress {
  private caseId = "E2E";
  private round = "";
  private state = "preparing";
  private run = "";
  private activityStarted: number | undefined;
  private actors = new Map<string, string>();
  private started: number;
  private changed: number;
  private lastRun = "";
  private readonly write: (line: string) => void;
  private readonly now: () => number;
  constructor(write: (line: string) => void, now = Date.now) {
    this.write = write;
    this.now = now;
    this.started = this.changed = now();
  }
  private emit(detail: string) {
    this.changed = this.now();
    this.write(
      `[e2e] ${[this.caseId, this.round, detail].filter(Boolean).join(" | ")}\n`,
    );
  }
  event(event: EvidenceEvent) {
    const data = record(event.data);
    switch (event.kind) {
      case "execution_started":
        this.caseId = label(data.caseId);
        this.emit(
          `${label(data.entry)} | preparing | ${label(data.directory)}`,
        );
        break;
      case "iteration_started":
        this.round = `round ${count(data.index)}/${count(data.total)} ${label(data.roundId)}`;
        this.state = "running";
        this.run = this.lastRun = "";
        this.activityStarted = undefined;
        this.actors.clear();
        this.emit("started");
        break;
      case "run_progress": {
        const cursor = record(data.cursor),
          activity = record(data.activity),
          calls = record(data.calls);
        this.state = label(data.status);
        this.run = `${label(cursor.stageName)}/${label(cursor.stepName)}`;
        const name =
          activity.kind === "model_request"
            ? "model request"
            : activity.kind === "human_wait"
              ? "waiting for simulated user"
              : activity.kind === "tool"
                ? "tool running"
                : label(activity.kind, this.state);
        const parsed =
          typeof activity.startedAt === "string"
            ? Date.parse(activity.startedAt)
            : NaN;
        this.activityStarted = Number.isFinite(parsed) ? parsed : undefined;
        const line = `${this.run} | ${name} | model requests ${count(calls.modelRequests)} | tools ${count(calls.tools)}`;
        if (line !== this.lastRun) {
          this.lastRun = line;
          this.emit(`${this.state} | ${line}`);
        }
        break;
      }
      case "model_connection_started": {
        const actor = label(data.actor);
        this.actors.set(actor, `connecting, attempt ${count(data.attempt)}`);
        this.emit(
          `${actor} | model request attempt ${count(data.attempt)}${typeof data.attempt === "number" && data.attempt > 1 ? ` (SDK retry ${data.attempt - 1})` : ""}`,
        );
        break;
      }
      case "model_stream_opened":
        this.actors.set(label(data.actor), "receiving model response");
        this.emit(
          `${label(data.actor)} | response stream opened after ${count(data.elapsedMs)}ms`,
        );
        break;
      case "model_stream_observation":
      case "model_step":
      case "model_task_completed":
        this.actors.delete(label(data.actor));
        break;
      case "model_connection_failed":
        this.actors.delete(label(data.actor));
        this.emit(
          `${label(data.actor)} | attempt ${count(data.attempt)} failed | ${label(data.transportCode, data.httpStatus === undefined ? "request error" : `HTTP ${count(data.httpStatus)}`)}`,
        );
        break;
      case "preparation_started":
      case "checks_started":
        this.state = event.kind === "checks_started" ? "checking" : "preparing";
        this.emit(`${this.state} | ${label(data.script)}`);
        break;
      case "preparation_finished":
      case "checks_finished":
        this.emit(
          `${label(data.script)} | ${data.code === 0 ? "passed" : "failed"}`,
        );
        break;
      case "iteration_finished":
        this.state = "round completed";
        this.actors.clear();
        this.activityStarted = undefined;
        this.emit(`completed | checks ${label(data.checks)}`);
        break;
      case "failure":
        this.state = "failed";
        this.actors.clear();
        this.activityStarted = undefined;
        this.emit(
          `${this.run ? `${this.run} | ` : ""}failed | ${label(data.code)} | ${label(data.message)}`,
        );
        break;
    }
  }
  heartbeat() {
    const now = this.now();
    this.write(
      `[e2e] ${[
        this.caseId,
        this.round,
        "heartbeat",
        this.state,
        this.lastRun,
        ...[...this.actors].map(([actor, activity]) => `${actor}: ${activity}`),
        `elapsed ${duration(now - this.started)}`,
        ...(this.activityStarted === undefined
          ? []
          : [`activity ${duration(now - this.activityStarted)}`]),
        `last change ${duration(now - this.changed)} ago`,
      ]
        .filter(Boolean)
        .join(" | ")}\n`,
    );
  }
}
