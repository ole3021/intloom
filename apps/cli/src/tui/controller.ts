import { resolve } from "node:path";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { useRenderer, useTerminalDimensions } from "@opentui/solid";
import { createCliCore, type CliCore } from "../core/index.ts";
import { createTuiSession, type TuiSnapshot } from "./session.ts";
import { useActivity, useTransitionAccent } from "./motion.ts";
import { createDrafts } from "./drafts.ts";
import { createRunActions } from "./actions.ts";
import { createCommands } from "./commands.ts";
import { windows, useNavigationKeys, type Dialog } from "./navigation.ts";
import { runnable, newest, unfinished } from "./selectors.ts";
export function createTuiController(props: {
  projectPath: string;
  core?: CliCore;
}) {
  const core = props.core ?? createCliCore();
  const renderer = useRenderer(),
    dimensions = useTerminalDimensions();
  const [snapshot, setSnapshot] = createSignal<TuiSnapshot>({
    projectPath: resolve(props.projectPath),
    connection: "loading",
    ready: false,
    looms: [],
    runs: [],
    message: "Loading project…",
  });
  const session = createTuiSession(core, snapshot().projectPath, setSnapshot);

  const [view, setView] = createSignal<(typeof windows)[number]>("workbench");
  const [assetsVisited, setAssetsVisited] = createSignal(false);
  createEffect(() => {
    if (view() === "resources") setAssetsVisited(true);
  });
  const [dialog, setDialog] = createSignal<Dialog>();
  const [selectedRun, setSelectedRun] = createSignal<string>();
  const { loom, setLoom, draft, setDraft, drafts, getDraft } = createDrafts();

  const [command, setCommand] = createSignal("");
  const [commandQuery, setCommandQuery] = createSignal("/");

  let enteredInstance: string | undefined,
    disposed = false;
  const run = () =>
    snapshot().runs.find((item) => item.runId === selectedRun());
  const connected = () =>
    snapshot().connection === "running" && snapshot().ready;

  const accent = useTransitionAccent(
    () => `${view()}/${selectedRun() ?? "intent"}`,
  );
  const input = (instanceId = snapshot().instanceId) => ({
    projectPath: snapshot().projectPath,
    ...(instanceId ? { serviceInstanceId: instanceId } : {}),
  });

  createEffect(() => {
    const state = snapshot();
    if (!state.ready || !state.instanceId) return;
    if (!loom()) {
      const first = state.looms.find(runnable);
      if (first?.loomName) setLoom(first.loomName);
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

  function newRun(loomName?: string) {
    if (loomName) setLoom(loomName);
    setSelectedRun(undefined);
    setView("workbench");
    setDialog(undefined);
    if (!loom()) setDialog("looms");
  }
  function selectRun(runId: string) {
    setSelectedRun(runId);
    setDialog(undefined);
  }
  function openCommands(query = "/") {
    setCommandQuery(query);
    setDialog("commands");
  }
  const {
    busy,
    pending,
    controlTarget,
    canWrite,
    check,
    submitDraft,
    answer,
    openControl,
    cancel,
    resume,
  } = createRunActions({
    core,
    session,
    snapshot,
    run,
    input,
    connected,
    selectRun,
    setView,
    setDraft,
    setDialog,
    loom,
    isDisposed: () => disposed,
    executeCommand: (text) => commandHandlers.executeCommand(text),
  });
  const focused = () => !dialog() && !busy() && !pending();
  const activity = useActivity(
    () =>
      snapshot().connection === "loading" ||
      busy() ||
      (connected() && run()?.status === "running"),
  );

  const commandHandlers = createCommands({
    snapshot,
    run,
    connected,
    canWrite,
    controlTarget,
    setCommand,
    setDialog,
    newRun,
    openControl,
    quit: () => renderer.destroy(),
    message: (text) => session.message(text),
  });
  const { executeCommand, commands, loomChoices, resumeChoices } =
    commandHandlers;

  useNavigationKeys({
    dialog,
    setDialog,
    view,
    setView,
    connected,
    pending,
    selectedRun,
    snapshot,
    openCommands,
  });

  return {
    core,
    session,
    dimensions,
    snapshot,
    windows,
    view,
    setView,
    assetsVisited,
    dialog,
    setDialog,
    selectedRun,
    loom,
    draft,
    setDraft,
    command,
    setCommand,
    commandQuery,
    busy,
    pending,
    controlTarget,
    run,
    connected,
    canWrite,
    focused,
    activity,
    accent,
    drafts,
    getDraft,
    newRun,
    selectRun,
    openCommands,
    check,
    submitDraft,
    answer,
    cancel,
    resume,
    executeCommand,
    commands,
    loomChoices,
    resumeChoices,
  };
}
export type TuiController = ReturnType<typeof createTuiController>;
