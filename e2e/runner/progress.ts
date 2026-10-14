import type { EvidenceEvent } from "./evidence.ts";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function line(value: unknown) {
  return String(value ?? "unavailable")
    .replace(/\p{Cc}/gu, " ")
    .slice(0, 240);
}
export class Progress {
  private started = Date.now();
  private current = "preparing execution";
  private lastRun = "";
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly write: (line: string) => void;
  constructor(write: (line: string) => void) {
    this.write = write;
  }
  private log(message: string) {
    this.write(
      `[${new Date().toISOString()}] [e2e +${Math.floor((Date.now() - this.started) / 1000)}s] ${message}\n`,
    );
  }
  start() {
    this.timer = setInterval(
      () => this.log(`Still active: ${this.current}.`),
      30000,
    );
    this.timer.unref();
  }
  close() {
    if (this.timer) clearInterval(this.timer);
  }
  handle = (event: EvidenceEvent) => {
    const data = object(event.data);
    switch (event.kind) {
      case "execution_started":
        this.log(
          `Entry ${line(data.entry)}, case ${line(data.caseId)}; directory ${line(data.directory)}.`,
        );
        break;
      case "workspace_build_started":
        this.current = "building current workspace";
        this.log("Building current CLI/Workflow candidates.");
        break;
      case "workspace_build":
        this.log(`Workspace build exited ${line(data.code)}.`);
        this.current = "preserving local runtime dependencies";
        break;
      case "workspace_package":
        if (data.code !== 0)
          this.log(
            `Local package ${line(data.name)} failed: exit ${line(data.code)}.`,
          );
        break;
      case "workspace_candidate_ready":
        this.log(
          `Local candidate ready: ${line(data.packages)} runtime packages preserved.`,
        );
        break;
      case "configuration":
        this.log("Project configured; mirror capture enabled.");
        break;
      case "workspace_seeded":
        this.log("Case workspace prepared.");
        break;
      case "model_started":
        this.current = `AI ${line(data.actor)} (${line(data.model)})`;
        this.log(`${this.current} started.`);
        break;
      case "model_connection_started":
        this.current = `AI ${line(data.actor)}`;
        break;
      case "model_final":
        this.log(
          `AI ${line(data.actor)} finished: ${line(data.finishReason)}.`,
        );
        break;
      case "model_task_completed":
        this.log(`AI ${line(data.actor)} submitted its task outcome.`);
        break;
      case "model_completion_rejected":
        this.log(
          `AI ${line(data.actor)} completion rejected: ${line(data.code)}.`,
        );
        break;
      case "model_error":
        this.log(`AI ${line(data.actor)} error: ${line(data.diagnostic)}.`);
        break;
      case "model_stream_failed":
        this.log(
          `AI ${line(data.actor)} stream failed: ${line(data.code)}; no retry. See evidence.`,
        );
        break;
      case "sdk_diagnostic":
        this.log(
          `SDK diagnostic: ${line(String(data.message ?? "").split("\n")[0])}; see evidence.`,
        );
        break;
      case "model_connection_retry":
        this.log(
          `AI ${line(data.actor)} connection ${line(data.code)}; retry ${line(data.attempt)}/${line(data.retries)} before response.`,
        );
        break;
      case "iteration_started":
        this.current = `iteration ${line(data.index)}/${line(data.total)}`;
        this.log(`Starting ${this.current}.`);
        break;
      case "iteration_finished":
        this.log(
          `Iteration ${line(data.index)}/${line(data.total)} completed; Run ${line(data.runId)}; acceptance ${line(data.acceptance)}.`,
        );
        break;
      case "acceptance_started":
        this.current = `Workflow acceptance ${line(data.script)}`;
        this.log(`${this.current} started.`);
        break;
      case "preparation_started":
        this.current = `Workflow preparation ${line(data.script)}`;
        this.log(`${this.current} started.`);
        break;
      case "preparation_finished":
        this.log(
          `Workflow preparation ${line(data.script)}: exit ${line(data.code)}.`,
        );
        break;
      case "acceptance_finished":
        this.log(
          `Workflow acceptance ${line(data.script)}: exit ${line(data.code)}.`,
        );
        break;
      case "run_observed": {
        const cursor = object(data.cursor);
        const state = `${line(data.runId)} ${line(data.status)} at ${line(cursor.stageName)}/${line(cursor.stepName)}${data.stepVisitId === undefined ? "" : ` (visit ${line(data.stepVisitId)})`}${data.actionId ? `; pending action ${line(data.actionId)}` : ""}`;
        this.current = state;
        if (state !== this.lastRun) {
          this.log(`Run ${state}.`);
          this.lastRun = state;
        }
        break;
      }
      case "answer_rejected":
        this.log(
          `Answer rejected for ${line(data.actionId)} (${line(data.attempt)}/2): ${line(data.reason)}.`,
        );
        break;
      case "answer_accepted":
        this.log(
          `Answer accepted for ${line(data.actionId)} (${line(data.kind)}${typeof data.confirmed === "boolean" ? `; ${data.confirmed ? "confirmed" : "revision requested"}` : ""}).`,
        );
        break;
      case "cli": {
        const args = Array.isArray(data.args) ? data.args : [];
        const result = object(data.result);
        if (
          result.code !== 0 ||
          [
            "init",
            "workflow",
            "start",
            "doctor",
            "flow",
            "answer",
            "cancel",
            "stop",
          ].includes(String(args[0]))
        )
          this.log(
            `CMD ${line(args[0])}${args[0] === "workflow" ? ` ${line(args[1])}` : ""}: exit ${line(result.code)}${object(object(data.data).error).code ? ` (${line(object(object(data.data).error).code)})` : ""}.`,
          );
        break;
      }
      case "mcp_connected":
        this.log("MCP connection established.");
        break;
      case "mcp":
        if (
          object(data.result).isError ||
          [
            "flow",
            "claim_agent_call",
            "complete_agent_call",
            "fail_agent_call",
          ].includes(String(data.name))
        )
          this.log(
            `MCP ${line(data.name)}: ${object(data.result).isError ? "failed" : "accepted"}.`,
          );
        break;
      case "user_action_error":
        this.log(
          `Action ${line(data.name)} failed: ${line(object(data.error).code)}; ${line(object(data.error).message)}.`,
        );
        break;
      case "codex_process":
        this.current = `Codex ${line(data.phase)} session`;
        this.log(`${this.current} started.`);
        break;
      case "codex_exit":
        this.log(`Codex ${line(data.phase)} session: exit ${line(data.code)}.`);
        break;
      case "verification_started":
        this.current = "collecting independent functional and mirror evidence";
        this.log("Independent verification started.");
        break;
      case "failure":
        this.log(
          `Failed: ${line(data.code)} (${line(data.category)}): ${line(data.message)}`,
        );
        break;
      case "collection_failed":
      case "cleanup_failed":
        this.log(
          `${event.kind === "cleanup_failed" ? "Cleanup" : "Evidence collection"} failed: ${line(data.diagnostic)}.`,
        );
        break;
      case "execution_finished":
        this.current = `finished (${line(data.status)})`;
        this.log(
          `Result ${line(data.status)}; ${line(data.checksPassed)}/${line(data.checksTotal)} checks passed; ${line(data.mirrors)} mirrors; cleanup ${line(data.cleanup)}.`,
        );
        break;
    }
  };
}
