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
  ready: boolean;
  workflows: readonly WorkflowView[];
  runs: readonly ServiceRunView[];
  message: string;
}
/** UI connection and selection state only; Run snapshots and counters come intact from Core. */
export function createTuiSession(
  core: Pick<CliCore, "getServiceStatus" | "startService" | "watchProject">,
  projectPath: string,
  changed: (state: TuiSnapshot) => void,
) {
  let state: TuiSnapshot = {
    projectPath,
    connection: "loading",
    ready: false,
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
  async function refresh(options: { startIfStopped?: boolean } = {}) {
    const current = ++generation;
    observer?.abort();
    publish({ ready: false, message: "Connecting to the project Service…" });
    let result = await core.getServiceStatus({ projectPath });
    if (disposed || current !== generation) return;
    if (
      result.ok &&
      result.data.status === "stopped" &&
      options.startIfStopped
    ) {
      publish({
        connection: "loading",
        message: "Starting the project Service…",
      });
      const started = await core.startService({
        projectPath: result.data.projectRoot,
      });
      if (disposed || current !== generation) return;
      if (!started.ok) {
        publish({
          connection: "unavailable",
          message: `${started.error.code}: ${started.error.message}`,
        });
        return;
      }
      result = await core.getServiceStatus({ projectPath });
      if (disposed || current !== generation) return;
    }
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
            ? "Service stopped. Select Inspect and reconnect to continue."
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
      ...(state.instanceId !== serviceInstanceId
        ? { runs: [], workflows: [] }
        : {}),
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
          return;
        }
        const data = event.data;
        if (data.type === "project_snapshot")
          publish({
            connection: "running",
            ready: true,
            workflows: data.workflows,
            runs: [
              ...state.runs.filter(
                (old) => !data.runs.some((run) => run.runId === old.runId),
              ),
              ...data.runs.map((run) => {
                const old = state.runs.find((item) => item.runId === run.runId);
                return old && old.revision > run.revision ? old : run;
              }),
            ],
          });
        else if (data.type === "run_snapshot") {
          observeRun(data.run);
        } else if (data.type === "service_closing") {
          publish({
            connection: "disconnected",
            message:
              "Service is closing. Select Inspect and reconnect to inspect its state.",
          });
          return;
        }
      }
      if (!disposed && current === generation && !abort.signal.aborted)
        publish({
          connection: "disconnected",
          message: "Observation ended. Select Inspect and reconnect.",
        });
    })().catch(() => {
      if (!disposed && current === generation)
        publish({
          connection: "disconnected",
          message: "Observation ended. Refresh to inspect the Service.",
        });
    });
  }
  function observeRun(run: ServiceRunView) {
    if (run.serviceInstanceId !== state.instanceId) return;
    const old = state.runs.find((item) => item.runId === run.runId);
    if (!old || run.revision > old.revision)
      publish({
        runs: [...state.runs.filter((item) => item.runId !== run.runId), run],
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
    observeRun,
    message(message: string) {
      publish({ message });
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
