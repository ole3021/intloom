import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  createEffect,
  createSignal,
  For,
  Show,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js";
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReadonlyJsonValue, WorkflowView } from "@intloom/kernel";
import {
  createCliCore,
  type CliCore,
  type CoreResult,
  type ServiceRunView,
} from "../core/index.ts";
import { formatLog } from "../ui/logs.ts";
import { createTuiSession, type TuiSnapshot } from "./session.ts";
import { Composer, Picker, displayStatus, type Choice } from "./widgets.tsx";
import { AnswerForm, emptyAnswerDraft, type AnswerDraft } from "./answer.tsx";
import { Resources } from "./resources.tsx";
import { useActivity, useTransitionAccent } from "./motion.ts";
import { primaryColor } from "./theme.ts";

type Admission = Extract<
  Awaited<ReturnType<CliCore["flow"]>>,
  { ok: true }
>["data"];

type Dialog = "workflows" | "runs" | "commands" | "cancel" | "resume";
interface PendingWrite {
  kind: "flow" | "answer" | "resume" | "cancel";
  instanceId: string;
  operationId?: string;
  runId?: string;
}
const runnable = (workflow: WorkflowView) =>
  workflow.isAvailable &&
  (!workflow.readiness || workflow.readiness.status === "available");
const unfinished = (run: ServiceRunView) =>
  ["running", "waiting", "paused"].includes(run.status);
const newest = (runs: readonly ServiceRunView[]) =>
  [...runs].sort(
    (a, b) =>
      Number(unfinished(b)) - Number(unfinished(a)) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );

export function App(props: { projectPath: string; core?: CliCore }) {
  const core = props.core ?? createCliCore();
  const renderer = useRenderer(),
    dimensions = useTerminalDimensions();
  const [snapshot, setSnapshot] = createSignal<TuiSnapshot>({
    projectPath: resolve(props.projectPath),
    connection: "loading",
    ready: false,
    workflows: [],
    runs: [],
    message: "Loading project…",
  });
  const session = createTuiSession(core, snapshot().projectPath, setSnapshot);
  const windows = ["workbench", "logs", "resources"] as const;
  const [view, setView] = createSignal<(typeof windows)[number]>("workbench");
  const [assetsVisited, setAssetsVisited] = createSignal(false);
  createEffect(() => {
    if (view() === "resources") setAssetsVisited(true);
  });
  const [dialog, setDialog] = createSignal<Dialog>();
  const [selectedRun, setSelectedRun] = createSignal<string>();
  const [flow, setFlow] = createSignal("");
  const [intent, setIntent] = createSignal("");
  const [command, setCommand] = createSignal("");
  const [commandQuery, setCommandQuery] = createSignal("/");
  const [busy, setBusy] = createSignal(false);
  const [pending, setPending] = createSignal<PendingWrite>();
  const [controlTarget, setControlTarget] = createSignal<ServiceRunView>();
  const drafts = new Map<string, AnswerDraft>();
  let enteredInstance: string | undefined,
    disposed = false;
  const run = () =>
    snapshot().runs.find((item) => item.runId === selectedRun());
  const connected = () =>
    snapshot().connection === "running" && snapshot().ready;
  const canWrite = () => connected() && !busy() && !pending();
  const focused = () => !dialog() && !busy() && !pending();
  const activity = useActivity(
    () =>
      snapshot().connection === "loading" ||
      busy() ||
      (connected() && run()?.status === "running"),
  );
  const accent = useTransitionAccent(
    () => `${view()}/${selectedRun() ?? "intent"}`,
  );
  const input = (instanceId = snapshot().instanceId) => ({
    projectPath: snapshot().projectPath,
    ...(instanceId ? { serviceInstanceId: instanceId } : {}),
  });
  const getDraft = (key: string) => {
    let draft = drafts.get(key);
    if (!draft) {
      draft = emptyAnswerDraft();
      drafts.set(key, draft);
    }
    return draft;
  };
  createEffect(() => {
    const state = snapshot();
    if (!state.ready || !state.instanceId) return;
    if (!flow()) {
      const first = state.workflows.find(runnable);
      if (first?.flowName) setFlow(first.flowName);
    }
    if (enteredInstance === state.instanceId) return;
    enteredInstance = state.instanceId;
    const active = newest(state.runs).filter(unfinished);
    setSelectedRun(active[0]?.runId);
    if (active.length > 1) setDialog("runs");
  });
  onMount(() => {
    void session.refresh({ startIfStopped: true });
  });
  onCleanup(() => {
    disposed = true;
    session.dispose();
  });

  function newRun(flowName?: string) {
    if (flowName) setFlow(flowName);
    setSelectedRun(undefined);
    setView("workbench");
    setDialog(undefined);
    if (!flow()) setDialog("workflows");
  }
  function selectRun(runId: string) {
    setSelectedRun(runId);
    setDialog(undefined);
  }
  function openCommands(query = "/") {
    setCommandQuery(query);
    setDialog("commands");
  }
  async function inspectRun(runId: string, instanceId: string) {
    const result = await core.getRun({ ...input(instanceId), runId });
    if (!disposed && result.ok) session.observeRun(result.data);
    else if (!disposed) session.report(result);
  }
  function accepted(write: PendingWrite, admission: Admission) {
    const receipt = admission.receipt;
    if (receipt.status === "pending") {
      setPending(write);
      session.message(
        `Operation pending · ${write.operationId} · Inspect the original operation below`,
      );
    } else if (receipt.status === "rejected") {
      setPending(undefined);
      session.message(`${receipt.error.code}: ${receipt.error.message}`);
    } else {
      setPending(undefined);
      if (admission.run) session.observeRun(admission.run);
      selectRun(receipt.runId);
      setView("workbench");
      if (write.kind === "flow") setIntent("");
      session.message(`Operation accepted · Run ${receipt.runId}`);
      if (!admission.run) void inspectRun(receipt.runId, write.instanceId);
    }
  }
  async function admit(
    write: PendingWrite,
    execute: () => Promise<CoreResult<Admission>>,
  ) {
    if (!canWrite()) return;
    setBusy(true);
    setPending(write);
    try {
      const result = await execute();
      if (disposed) return;
      if (result.ok) accepted(write, result.data);
      else {
        if (result.outcome === "not_applied") setPending(undefined);
        session.report(result);
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  async function check() {
    const write = pending();
    if (!write || busy()) return;
    setBusy(true);
    try {
      if (write.kind === "cancel" && write.runId) {
        const result = await core.getRun({
          ...input(write.instanceId),
          runId: write.runId,
        });
        if (disposed) return;
        if (!result.ok) session.report(result);
        else {
          session.observeRun(result.data);
          if (result.data.stopReason === "user_cancel") {
            setPending(undefined);
            session.message("Cancellation confirmed.");
          } else
            session.message(
              "Cancellation outcome remains unknown. Original Run retained; no retry sent.",
            );
        }
      } else if (write.operationId) {
        const result = await core.getOperation({
          ...input(write.instanceId),
          operationId: write.operationId,
        });
        if (disposed) return;
        if (!result.ok) session.report(result);
        else if (result.data) accepted(write, { receipt: result.data });
        else
          session.message(
            `No receipt for ${write.operationId}. Outcome remains unknown; no retry sent.`,
          );
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  function submitIntent(text: string) {
    if (text.trim().startsWith("/") && !text.includes("\n")) {
      executeCommand(text.trim());
      setIntent("");
      return;
    }
    const instanceId = snapshot().instanceId;
    if (!instanceId || !canWrite() || !text.trim()) return;
    if (
      !snapshot().workflows.some(
        (item) => item.flowName === flow() && runnable(item),
      )
    ) {
      session.message("Choose an available Workflow before submitting.");
      setDialog("workflows");
      return;
    }
    const write: PendingWrite = {
      kind: "flow",
      instanceId,
      operationId: randomUUID(),
    };
    void admit(write, () =>
      core.flow({
        ...input(instanceId),
        serviceInstanceId: instanceId,
        operationId: write.operationId as string,
        flowName: flow(),
        intent: text,
      }),
    );
  }
  function answer(answer: ReadonlyJsonValue, actionId: string) {
    const current = run(),
      instanceId = snapshot().instanceId;
    if (!current || !instanceId || current.pendingAction?.id !== actionId) {
      session.message("Pending action changed. Inspect the current Run.");
      return;
    }
    const write: PendingWrite = {
      kind: "answer",
      instanceId,
      runId: current.runId,
      operationId: randomUUID(),
    };
    void admit(write, () =>
      core.answerAsk({
        ...input(instanceId),
        serviceInstanceId: instanceId,
        operationId: write.operationId as string,
        runId: current.runId,
        actionId,
        answer,
      }),
    );
  }
  function openControl(kind: "cancel" | "resume") {
    const current = run();
    if (
      !current ||
      !canWrite() ||
      (kind === "cancel" ? !unfinished(current) : current.status !== "paused")
    ) {
      session.message(
        kind === "cancel"
          ? "Select an unfinished Run to cancel."
          : "Select a paused Run to continue.",
      );
      return;
    }
    setControlTarget(current);
    setDialog(kind);
  }
  async function cancel() {
    const target = controlTarget();
    if (!target || !canWrite()) return;
    setDialog(undefined);
    setBusy(true);
    const write: PendingWrite = {
      kind: "cancel",
      instanceId: target.serviceInstanceId,
      runId: target.runId,
    };
    setPending(write);
    try {
      const result = await core.cancelRun({
        ...input(write.instanceId),
        runId: target.runId,
      });
      if (disposed) return;
      if (result.ok) {
        session.observeRun(result.data);
        setPending(undefined);
      } else if (result.outcome === "not_applied") setPending(undefined);
      session.report(result);
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  function resume(choice: string) {
    const target = controlTarget();
    if (!target || !canWrite()) return;
    setDialog(undefined);
    const write: PendingWrite = {
      kind: "resume",
      instanceId: target.serviceInstanceId,
      runId: target.runId,
      operationId: randomUUID(),
    };
    const scope =
      choice === "abandon"
        ? "workflow"
        : choice === "current"
          ? undefined
          : (choice as "step" | "stage" | "workflow");
    void admit(write, () =>
      core.resumeRun({
        ...input(write.instanceId),
        serviceInstanceId: write.instanceId,
        runId: target.runId,
        operationId: write.operationId as string,
        expectedRevision: target.revision,
        ...(scope ? { scope } : {}),
        ...(choice === "abandon" ? { abandonMirror: true } : {}),
      }),
    );
  }
  function executeCommand(text: string) {
    const [name, ...args] = text.split(/\s+/);
    setCommand("");
    setDialog(undefined);
    switch (name) {
      case "/run":
        newRun(args.join(" ") || undefined);
        break;
      case "/workflow":
        setDialog("workflows");
        break;
      case "/runs":
        setDialog("runs");
        break;
      case "/stop":
        openControl("cancel");
        break;
      case "/resume":
        openControl("resume");
        break;
      case "/quit":
        renderer.destroy();
        break;
      default:
        session.message(
          "Unknown command. Type / to see the six available commands.",
        );
    }
  }
  const commands = (): Choice[] => [
    {
      id: "/run",
      name: "/run",
      description: canWrite()
        ? "Create a new intent draft"
        : "Unavailable while Service is disconnected or an operation is pending",
      disabled: !canWrite(),
    },
    {
      id: "/workflow",
      name: "/workflow",
      description: connected()
        ? "Choose Workflow for a new Run · Ctrl+P"
        : "Connect to the project Service first",
      disabled: !connected(),
    },
    {
      id: "/runs",
      name: "/runs",
      description:
        connected() && snapshot().runs.length
          ? "Switch Run · Ctrl+O"
          : "No connected Runs to select",
      disabled: !connected() || !snapshot().runs.length,
    },
    {
      id: "/stop",
      name: "/stop",
      description:
        run() && unfinished(run() as ServiceRunView) && canWrite()
          ? "Stop the selected unfinished Run · requires confirmation"
          : "Select an unfinished Run; resolve any pending operation first",
      disabled: !run() || !unfinished(run() as ServiceRunView) || !canWrite(),
    },
    {
      id: "/resume",
      name: "/resume",
      description:
        run()?.status === "paused" && canWrite()
          ? "Continue the selected paused Run"
          : "Select a paused Run; resolve any pending operation first",
      disabled: run()?.status !== "paused" || !canWrite(),
    },
    {
      id: "/quit",
      name: "/quit",
      description: "Close TUI; background Runs keep executing",
    },
  ];
  const workflowChoices = (): Choice[] =>
    snapshot().workflows.map((item, index) => ({
      id: String(index),
      name: item.flowName ?? item.packageName,
      disabled: !runnable(item),
      description: item.isAvailable
        ? `${item.packageName} · ${item.readiness?.status ?? "available"}${item.readiness?.error ? ` · ${item.readiness.error.message}` : ""}`
        : `${item.phase} · ${item.error.code}: ${item.error.message}`,
    }));
  const resumeChoices = (): Choice[] => {
    const control = controlTarget()?.control;
    if (!control) return [];
    const boundary =
      control.capturePending?.boundary.kind ?? control.boundary?.kind;
    return [
      ...(!control.scope.completed
        ? [
            {
              id: "current",
              name: `Continue ${control.scope.kind} scope`,
              description:
                control.pauseReason === "mirror_capture_failed"
                  ? "Retry capture at the saved boundary"
                  : "Continue under the existing execution rules",
            },
          ]
        : []),
      ...[
        {
          id: "step",
          name: "Continue one Step",
          description: "Requires a step_before boundary",
          disabled: boundary !== "step_before",
        },
        {
          id: "stage",
          name: "Continue this Stage",
          description: "Continue the current Stage visit",
          disabled: boundary === "stage_end",
        },
        {
          id: "workflow",
          name: "Continue Workflow",
          description: "Continue to completion or the next user action",
        },
      ],
      ...(control.pauseReason === "mirror_capture_failed"
        ? [
            {
              id: "abandon",
              name: "Continue Workflow without mirror capture",
              description:
                "Explicitly abandon further mirror capture for this Run",
            },
          ]
        : []),
    ];
  };
  useKeyboard((key) => {
    if (key.defaultPrevented) return;
    if (dialog()) {
      if (key.name === "escape") {
        key.preventDefault();
        key.stopPropagation();
        setDialog(undefined);
      } else if (key.name === "tab") {
        key.preventDefault();
        key.stopPropagation();
      }
      return;
    }
    if (key.name === "tab" && !key.ctrl) {
      key.preventDefault();
      key.stopPropagation();
      setView(
        windows[(windows.indexOf(view()) + 1) % windows.length] ?? "workbench",
      );
    } else if (key.ctrl && ["o", "p"].includes(key.name)) {
      key.preventDefault();
      key.stopPropagation();
      setDialog(key.name === "o" ? "runs" : "workflows");
    } else if (
      key.sequence === "/" &&
      (view() === "logs" ||
        !connected() ||
        pending() ||
        (!selectedRun() && !snapshot().workflows.some(runnable)))
    ) {
      key.preventDefault();
      key.stopPropagation();
      openCommands();
    }
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      paddingX={1}
      backgroundColor="#10151d"
    >
      <text
        flexShrink={0}
        fg={primaryColor}
      >{`${activity()} IntLoom · ${snapshot().projectPath} · ${snapshot().connection}${busy() ? " · working" : ""}`}</text>
      <box flexDirection="row" flexShrink={0} gap={2}>
        <For each={windows}>
          {(window) => (
            <text
              fg={view() === window ? primaryColor : "#9299a5"}
            >{`${view() === window ? "› " : "  "}${window === "workbench" ? "Run" : window === "logs" ? "Logs" : "Assets"}`}</text>
          )}
        </For>
      </box>
      <Show when={snapshot().connection === "uninitialized"}>
        <box
          flexGrow={1}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
        >
          <text flexShrink={0}>This directory is not an IntLoom project.</text>
          <text flexShrink={0}>Run intloom init in CMD to initialize it.</text>
        </box>
      </Show>
      <Show when={snapshot().connection !== "uninitialized"}>
        <Show
          when={snapshot().ready && snapshot().connection === "running"}
          fallback={
            <box flexGrow={1} flexDirection="column" justifyContent="center">
              <text flexShrink={0}>{snapshot().message}</text>
              <Show when={snapshot().connection !== "loading"}>
                <select
                  height={3}
                  focused={!dialog() && !busy()}
                  options={[
                    {
                      name: "Inspect and reconnect",
                      value: "reconnect",
                      description:
                        "Start only if the Service is verified stopped",
                    },
                  ]}
                  onSelect={() => {
                    if (!dialog() && !busy())
                      void session.refresh({ startIfStopped: true });
                  }}
                />
              </Show>
            </box>
          }
        >
          <box
            flexGrow={1}
            flexDirection="row"
            visible={view() !== "resources"}
          >
            <box flexDirection="column" flexGrow={1}>
              <Show
                when={selectedRun()}
                fallback={
                  <box
                    flexGrow={1}
                    flexDirection="column"
                    justifyContent="center"
                    paddingX={2}
                  >
                    <Show
                      when={view() === "workbench"}
                      fallback={
                        <text>
                          No Run selected. Ctrl+O selects a Run to view its
                          logs.
                        </text>
                      }
                    >
                      <text flexShrink={0} fg={primaryColor}>
                        I N T L O O M
                      </text>
                      <text flexShrink={0}>
                        What would you like this Workflow to do?
                      </text>
                      <Show
                        when={snapshot().workflows.some(runnable)}
                        fallback={
                          <box flexDirection="column">
                            <text>
                              No runnable Workflow. Ctrl+P shows Workflow
                              readiness.
                            </text>
                            <For each={snapshot().workflows}>
                              {(item) => (
                                <text fg="#ecc77b">{`${item.flowName ?? item.packageName}: ${item.isAvailable ? (item.readiness?.error?.message ?? item.readiness?.status ?? "available") : item.error.message}`}</text>
                              )}
                            </For>
                            <text>
                              Use CMD for package and model configuration.
                            </text>
                          </box>
                        }
                      >
                        <box
                          flexDirection="column"
                          border
                          title="Intent"
                          borderColor={accent()}
                          paddingX={1}
                        >
                          <Composer
                            value={intent()}
                            change={setIntent}
                            submit={submitIntent}
                            commands={openCommands}
                            focused={
                              focused() && canWrite() && view() === "workbench"
                            }
                            placeholder="Describe your intent, or / for commands"
                          />
                          <text
                            flexShrink={0}
                            fg={primaryColor}
                          >{`Workflow: ${flow() || "Choose a Workflow"} · Ctrl+P Select`}</text>
                          <text flexShrink={0} fg="#9299a5">
                            Enter Submit · Shift+Enter New line · Long text
                            wraps automatically
                          </text>
                        </box>
                      </Show>
                    </Show>
                  </box>
                }
              >
                <text
                  flexShrink={0}
                >{`${run()?.flowName ?? "Run"} · ${selectedRun()} · ${run() ? displayStatus(run() as ServiceRunView) : "Loading Run…"}`}</text>
                <Show when={run()}>
                  {(current: Accessor<ServiceRunView>) => (
                    <>
                      <text
                        flexShrink={0}
                        fg="#9299a5"
                      >{`${current().cursor.stageName}/${current().cursor.stepName} · revision ${current().revision}${current().control?.pauseReason ? ` · ${current().control?.pauseReason}` : ""}`}</text>
                      <Show
                        when={
                          dimensions().width < 100 && view() === "workbench"
                        }
                      >
                        <text
                          flexShrink={0}
                        >{`${(current().activity ?? []).map((item) => item.kind).join(" · ")} · ${(current().results ?? []).length} results`}</text>
                      </Show>
                      <Show
                        when={`${current().serviceInstanceId}/${current().runId}`}
                        keyed
                      >
                        {() => (
                          <RunLogs
                            core={core}
                            projectPath={snapshot().projectPath}
                            runId={current().runId}
                            focused={focused() && view() === "logs"}
                          />
                        )}
                      </Show>
                      <Show when={current().lastError}>
                        <text
                          flexShrink={0}
                          fg="#ef9292"
                        >{`${current().lastError?.code}: ${current().lastError?.message}`}</text>
                      </Show>
                      <box
                        flexDirection="column"
                        visible={view() === "workbench"}
                      >
                        <Show
                          when={current().pendingAction?.id}
                          keyed
                          fallback={
                            <box
                              flexDirection="column"
                              border
                              paddingX={1}
                              title={
                                current().status === "paused"
                                  ? "Paused · /resume to continue"
                                  : current().status === "waiting"
                                    ? "Waiting for an external Agent"
                                    : unfinished(current())
                                      ? "Executing · /stop to stop"
                                      : "Run finished · /run for a new Run"
                              }
                            >
                              <Composer
                                height={2}
                                value={command()}
                                change={setCommand}
                                commands={openCommands}
                                focused={focused() && view() === "workbench"}
                                placeholder="/ for commands"
                                submit={(text) => executeCommand(text.trim())}
                              />
                            </box>
                          }
                        >
                          {(actionId: string) => {
                            const key = `${current().serviceInstanceId}/${current().runId}/${actionId}`;
                            return (
                              <AnswerForm
                                action={
                                  current().pendingAction as NonNullable<
                                    ServiceRunView["pendingAction"]
                                  >
                                }
                                draft={getDraft(key)}
                                save={(draft) => drafts.set(key, draft)}
                                commands={openCommands}
                                focused={
                                  focused() &&
                                  canWrite() &&
                                  view() === "workbench"
                                }
                                submit={answer}
                              />
                            );
                          }}
                        </Show>
                      </box>
                    </>
                  )}
                </Show>
              </Show>
            </box>
            <box
              width={30}
              flexDirection="column"
              border
              title="Run status"
              borderColor={accent()}
              paddingX={1}
              visible={
                Boolean(run()) &&
                dimensions().width >= 100 &&
                view() === "workbench"
              }
            >
              <scrollbox flexGrow={1} scrollX={false}>
                <Show when={run()}>
                  {(current: Accessor<ServiceRunView>) => (
                    <RunStatus run={current()} />
                  )}
                </Show>
              </scrollbox>
            </box>
          </box>
          <box
            flexGrow={1}
            flexDirection="column"
            visible={view() === "resources"}
          >
            <Show when={assetsVisited() && snapshot().instanceId} keyed>
              {(instanceId: string) => (
                <Resources
                  core={core}
                  projectPath={snapshot().projectPath}
                  instanceId={instanceId}
                  run={run()}
                  focused={focused() && view() === "resources"}
                  commands={openCommands}
                  back={() => setView("workbench")}
                />
              )}
            </Show>
          </box>
        </Show>
      </Show>
      <Show when={pending()}>
        <box flexDirection="column" border borderColor="#ecc77b">
          <text
            flexShrink={0}
            fg="#ecc77b"
          >{`Original ${pending()?.kind} · operation ${pending()?.operationId ?? "none"} · instance ${pending()?.instanceId}`}</text>
          <select
            height={2}
            focused={!dialog() && !busy()}
            options={[
              {
                name: "Inspect original operation",
                value: "check",
                description: "Query its receipt/Run; never submit it again",
              },
            ]}
            onSelect={() => {
              if (!dialog() && !busy()) void check();
            }}
          />
        </box>
      </Show>
      <Show when={view() !== "workbench"}>
        <box
          flexDirection="column"
          border
          height={3}
          borderColor={primaryColor}
        >
          <text>/ for commands · Ctrl+O Run · Ctrl+P Workflow</text>
        </box>
      </Show>
      <text flexShrink={0} maxHeight={2}>
        {snapshot().message}
      </text>
      <text flexShrink={0} fg="#9299a5">
        Tab Run / Logs / Assets · / Commands · Ctrl+O Run · Ctrl+P Workflow
      </text>
      <Show when={dialog()} keyed>
        {(mode: Dialog) => (
          <box
            position="absolute"
            left="5%"
            top={2}
            width="90%"
            backgroundColor="#18212e"
          >
            <Picker
              initialQuery={mode === "commands" ? commandQuery() : ""}
              title={
                mode === "workflows"
                  ? "Choose Workflow for a new Run"
                  : mode === "runs"
                    ? "Switch Run"
                    : mode === "cancel"
                      ? `Stop ${controlTarget()?.runId}?`
                      : mode === "resume"
                        ? `Continue paused Run · ${controlTarget()?.control?.pauseReason ?? "paused"}`
                        : "Commands · MVP"
              }
              choices={
                mode === "workflows"
                  ? workflowChoices()
                  : mode === "runs"
                    ? newest(snapshot().runs).map((item) => ({
                        id: item.runId,
                        name: `${item.flowName} · ${displayStatus(item)}`,
                        description: `${item.runId} · ${item.cursor.stageName}/${item.cursor.stepName}`,
                      }))
                    : mode === "cancel"
                      ? [
                          {
                            id: "back",
                            name: "Keep executing",
                            description: "Return to the Run",
                          },
                          {
                            id: "cancel",
                            name: "Stop Run",
                            description:
                              "Stops execution; committed resources remain.",
                          },
                        ]
                      : mode === "resume"
                        ? resumeChoices()
                        : commands()
              }
              select={(id, query) => {
                if (mode === "workflows") {
                  const item = snapshot().workflows[Number(id)];
                  if (item?.flowName && runnable(item)) newRun(item.flowName);
                } else if (mode === "runs") selectRun(id);
                else if (mode === "cancel") {
                  if (id === "cancel") void cancel();
                  else setDialog(undefined);
                } else if (mode === "resume") resume(id);
                else executeCommand(query.startsWith(`${id} `) ? query : id);
              }}
            />
          </box>
        )}
      </Show>
    </box>
  );
}

function RunStatus(props: { run: ServiceRunView }) {
  const metrics = () => props.run.metrics;
  const duration = (value: number) => `${Math.round(value / 1000)}s`;
  return (
    <>
      <text flexShrink={0}>{displayStatus(props.run)}</text>
      <text
        flexShrink={0}
      >{`${props.run.cursor.stageName}/${props.run.cursor.stepName}`}</text>
      <For each={props.run.activity}>
        {(item) => (
          <text
            flexShrink={0}
          >{`${item.kind}${item.agentId ? ` · ${item.agentId}` : ""}`}</text>
        )}
      </For>
      <Show
        when={metrics()}
        fallback={<text flexShrink={0}>Statistics unavailable</text>}
      >
        {(value: Accessor<NonNullable<ServiceRunView["metrics"]>>) => (
          <text
            flexShrink={0}
          >{`Execution ${duration(value().timing.executionMs)}\nHuman wait ${duration(value().timing.humanWaitMs)}\nModel calls ${value().calls.modelRequests}\nTools ${value().calls.tools}\nInput tokens ${value().usage.inputTokens ?? "unknown"}\nOutput tokens ${value().usage.outputTokens ?? "unknown"}\nUsage ${value().usage.completeness}\nEstimated USD ${value().cost.knownAmount ?? "unknown"}\nCost ${value().cost.completeness}\nResults ${(props.run.results ?? []).length}\nSettled ${props.run.settled}\n${value().recovered ? "Recovered in this instance" : "Current Service instance"}`}</text>
        )}
      </Show>
      <For each={Object.entries(props.run.limits ?? {})}>
        {([name, value]) => <text flexShrink={0}>{`${name}: ${value}`}</text>}
      </For>
      <text
        flexShrink={0}
        fg="#9299a5"
      >{`Instance ${props.run.serviceInstanceId}`}</text>
    </>
  );
}

function RunLogs(props: {
  core: CliCore;
  projectPath: string;
  runId: string;
  focused: boolean;
}) {
  const [lines, setLines] = createSignal<string[]>([]);
  const [omitted, setOmitted] = createSignal(0);
  const [message, setMessage] = createSignal("Loading logs…");
  const abort = new AbortController();
  let viewer: ScrollBoxRenderable | undefined;
  onMount(() => {
    void (async () => {
      for await (const result of props.core.watchLogs(
        { projectPath: props.projectPath, runId: props.runId, level: "info" },
        { signal: abort.signal },
      )) {
        if (abort.signal.aborted) break;
        if (!result.ok) {
          setMessage(`${result.error.code}: ${result.error.message}`);
          break;
        }
        setMessage("");
        setLines((items) => {
          if (items.length >= 200) setOmitted((value) => value + 1);
          return [...items.slice(-199), formatLog(result.data).trimEnd()];
        });
      }
    })().catch(() => {
      if (!abort.signal.aborted)
        setMessage("Log observation ended. Switch Run to reconnect.");
    });
  });
  onCleanup(() => abort.abort());
  useKeyboard((key) => {
    if (key.defaultPrevented || !props.focused) return;
    if (key.ctrl || key.meta) return;
    const amount = { up: -1, down: 1, pageup: -10, pagedown: 10 }[key.name];
    if (amount !== undefined || ["home", "end"].includes(key.name)) {
      key.preventDefault();
      if (amount !== undefined) viewer?.scrollBy(amount);
      else viewer?.scrollTo(key.name === "home" ? 0 : viewer.scrollHeight);
    }
  });
  return (
    <box flexGrow={1} flexDirection="column" minHeight={3}>
      <text
        flexShrink={0}
        fg="#9299a5"
      >{`Run logs · Tab to Logs · ↑/↓ or PageUp/PageDown Scroll · End Latest${omitted() ? ` · ${omitted()} earlier entries omitted` : ""}`}</text>
      <scrollbox
        ref={(value) => {
          viewer = value;
        }}
        flexGrow={1}
        stickyScroll
        stickyStart="bottom"
        scrollX={false}
      >
        <For each={lines()}>{(line) => <text flexShrink={0}>{line}</text>}</For>
        <text flexShrink={0}>{message()}</text>
      </scrollbox>
    </box>
  );
}
