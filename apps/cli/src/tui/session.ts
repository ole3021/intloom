import type { CliCore, CoreResult, ServiceRunView } from "../core/index.ts";
import type { WorkflowView } from "@intloom/kernel";
export interface TuiSnapshot {
  projectPath: string;
  connection:
    | "loading"
    | "uninitialized"
    | "stopped"
    | "running"
    | "unavailable"
    | "disconnected";
  instanceId?: string | undefined;
  workflows: readonly WorkflowView[];
  runs: readonly ServiceRunView[];
  message: string;
}
/** UI connection and selection state only; Run snapshots and counters come intact from Core. */
export function createTuiSession(
  core: CliCore,
  projectPath: string,
  changed: (state: TuiSnapshot) => void,
) {
  let state: TuiSnapshot = {
    projectPath,
    connection: "loading",
    workflows: [],
    runs: [],
    message: "Loading project…",
  };
  let observer: AbortController | undefined;
  let disposed = false;
  let generation = 0;
  const publish = (patch: Partial<TuiSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    changed(state);
  };
  async function refresh() {
    const current = ++generation;
    observer?.abort();
    const result = await core.getServiceStatus({ projectPath });
    if (disposed || current !== generation) return;
    if (!result.ok) {
      publish({
        connection:
          result.error.code === "CLI_PROJECT_INVALID"
            ? "uninitialized"
            : "unavailable",
        message: `${result.error.code}: ${result.error.message}`,
      });
      return;
    }
    if (result.data.status !== "running") {
      publish({
        connection:
          result.data.status === "stopped" ? "stopped" : "unavailable",
        runs: [],
        workflows: [],
        instanceId: undefined,
        message:
          result.data.status === "stopped"
            ? "Service stopped. Select Start Service."
            : result.data.diagnostic.message,
      });
      return;
    }
    const serviceInstanceId = result.data.service.instanceId;
    publish({
      projectPath: result.data.projectRoot,
      connection: "running",
      instanceId: serviceInstanceId,
      message: "Connected to the project Service.",
    });
    const abort = new AbortController();
    observer = abort;
    void (async () => {
      for await (const event of core.watchProject(
        { projectPath, serviceInstanceId },
        { signal: abort.signal },
      )) {
        if (disposed || current !== generation) break;
        if (!event.ok) {
          publish({
            connection: "disconnected",
            message: `${event.error.code}: ${event.error.message}`,
          });
          break;
        }
        const data = event.data;
        if (data.type === "project_snapshot")
          publish({
            connection: "running",
            workflows: data.workflows,
            runs: data.runs,
          });
        else if (data.type === "run_snapshot") {
          const old = state.runs.find((run) => run.runId === data.run.runId);
          if (!old || data.run.revision > old.revision)
            publish({
              runs: [
                ...state.runs.filter((run) => run.runId !== data.run.runId),
                data.run,
              ],
            });
        } else if (data.type === "service_closing")
          publish({
            connection: "disconnected",
            message:
              "Service is closing. Refresh to inspect its current state.",
          });
      }
    })().catch(() => {
      if (!disposed && current === generation)
        publish({
          connection: "disconnected",
          message: "Observation ended. Refresh to inspect the Service.",
        });
    });
  }
  function report(result: CoreResult<unknown>) {
    publish({
      message: result.ok
        ? "Operation accepted."
        : `${result.error.code}: ${result.error.message}${result.meta.operationId ? ` · operation ${result.meta.operationId}` : ""}${result.meta.serviceInstanceId ? ` · instance ${result.meta.serviceInstanceId}` : ""}`,
    });
  }
  return {
    refresh,
    report,
    changeProject(nextPath: string) {
      projectPath = nextPath;
      publish({
        projectPath: nextPath,
        runs: [],
        workflows: [],
        instanceId: undefined,
      });
      return refresh();
    },
    get snapshot() {
      return state;
    },
    dispose() {
      disposed = true;
      generation++;
      observer?.abort();
    },
  };
}
