import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { useKeyboard, useRenderer } from "@opentui/solid";
import type { TextareaRenderable } from "@opentui/core";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  type ReadonlyJsonValue,
} from "@intloom/kernel";
import {
  createCliCore,
  type CliCore,
  type ServiceRunView,
  type CoreResult,
} from "../core/index.ts";
import { createTuiSession, type TuiSnapshot } from "./session.ts";
import { formatRun } from "../cmd/render.ts";

type Mode =
  | "home"
  | "flows"
  | "intent"
  | "runs"
  | "run"
  | "answer"
  | "results"
  | "settings"
  | "init"
  | "add_package"
  | "remove_package"
  | "edit_config";
export function App(props: { projectPath: string; core?: CliCore }) {
  const core = props.core ?? createCliCore();
  const [snapshot, setSnapshot] = createSignal<TuiSnapshot>({
    projectPath: props.projectPath,
    connection: "loading",
    workflows: [],
    runs: [],
    message: "Loading…",
  });
  const session = createTuiSession(core, props.projectPath, setSnapshot);
  const [mode, setMode] = createSignal<Mode>("home");
  const [selectedFlow, setSelectedFlow] = createSignal("");
  const [selectedRun, setSelectedRun] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [details, setDetails] = createSignal("");
  const [configurationRevision, setConfigurationRevision] = createSignal("");
  let editor: TextareaRenderable | undefined;
  const renderer = useRenderer();
  const run = () =>
    snapshot().runs.find((item) => item.runId === selectedRun());
  const input = () => {
    const current = snapshot();
    return {
      projectPath: current.projectPath,
      ...(current.instanceId ? { serviceInstanceId: current.instanceId } : {}),
    };
  };
  const runSummary = () => {
    const current = run();
    return current
      ? formatRun(current)
      : "Waiting for the selected Run snapshot…";
  };
  const runProgress = () => {
    const current = run();
    return current
      ? `${current.cursor.stageName}\n${current.cursor.stepName}\n${current.status} · revision ${current.revision}`
      : "Select a Run to inspect";
  };
  const runMetrics = () => {
    const metrics = run()?.metrics;
    return metrics
      ? `Execution ${metrics.timing.executionMs} ms\nHuman wait ${metrics.timing.humanWaitMs} ms\nModels ${metrics.calls.modelRequests}\nTools ${metrics.calls.tools}\nInput ${metrics.usage.inputTokens ?? "unknown"}\nOutput ${metrics.usage.outputTokens ?? "unknown"}\nCost ${metrics.cost.knownAmount ?? "unknown"} USD\n${metrics.cost.completeness}`
      : "";
  };
  async function operation<T>(action: () => Promise<CoreResult<T>>) {
    if (busy()) return undefined;
    setBusy(true);
    try {
      const result = await action();
      session.report(result);
      return result;
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (busy()) return;
    const text = editor?.plainText ?? "";
    if (mode() === "init") {
      const result = await operation(() =>
        core.initProject({
          projectPath: resolve(snapshot().projectPath, text || "."),
        }),
      );
      if (result?.ok) {
        await session.changeProject(result.data.projectRoot);
        setMode("home");
      }
    } else if (
      ["add_package", "remove_package", "edit_config"].includes(mode())
    ) {
      if (!text.trim()) return;
      const result = await operation<unknown>(() =>
        mode() === "add_package"
          ? core.addWorkflowPackage({ ...input(), source: text })
          : mode() === "remove_package"
            ? core.removeWorkflowPackage({ ...input(), packageName: text })
            : core.updateProjectConfig({
                ...input(),
                configuration: text,
                revision: configurationRevision(),
              }),
      );
      if (result?.ok) {
        setDetails(JSON.stringify(result.data, null, 2));
        setMode("settings");
      }
    } else if (mode() === "intent") {
      const serviceInstanceId = snapshot().instanceId;
      if (!serviceInstanceId || !text.trim()) {
        setDetails("Provide complete intent and connect to a Service.");
        return;
      }
      const result = await operation(() =>
        core.flow({
          projectPath: snapshot().projectPath,
          serviceInstanceId,
          operationId: randomUUID(),
          flowName: selectedFlow(),
          intent: text,
        }),
      );
      if (result?.ok && result.data.run) {
        setSelectedRun(result.data.run.runId);
        setMode("run");
      }
    }
  }
  useKeyboard((key) => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      return;
    }
    if (!key.ctrl) return;
    if (key.name === "n") setMode("flows");
    if (key.name === "l") setMode("runs");
    if (key.name === "h") setMode("home");
    if (key.name === "g") setMode("settings");
    if (key.name === "r") void session.refresh();
    if (key.name === "return") void submit();
  });
  onMount(() => {
    void session.refresh();
  });
  onCleanup(() => {
    session.dispose();
    editor = undefined;
  });
  const homeOptions = () => [
    ...(snapshot().connection === "uninitialized"
      ? [
          {
            name: "Initialize project",
            value: "init",
            description: "Create a scaffold in a new or empty directory",
          },
        ]
      : []),
    ...(snapshot().connection === "stopped"
      ? [
          {
            name: "Start Service",
            value: "start",
            description: "Shared project execution process",
          },
        ]
      : []),
    {
      name: "Workflows",
      value: "flows",
      description: "Select a loaded Workflow",
    },
    {
      name: "Runs",
      value: "runs",
      description: "Inspect active and completed Runs",
    },
    {
      name: "Project settings",
      value: "settings",
      description: "MCP, configuration and diagnostics",
    },
    {
      name: "Refresh connection",
      value: "refresh",
      description: "Reconcile current Service state",
    },
  ];
  async function homeAction(value: string) {
    if (value === "start") {
      await operation(() => core.startService(input()));
      await session.refresh();
    } else if (value === "refresh") await session.refresh();
    else setMode(value as Mode);
  }
  async function runAction(value: string) {
    const current = run();
    if (!current) return;
    if (value === "answer") setMode("answer");
    else if (value === "cancel") {
      await operation(() =>
        core.cancelRun({ ...input(), runId: current.runId }),
      );
    } else if (value === "results") {
      setDetails("");
      setMode("results");
    }
  }
  async function submitAnswer(answer: ReadonlyJsonValue, actionId: string) {
    const current = run();
    const action = current?.pendingAction;
    const serviceInstanceId = snapshot().instanceId;
    if (!current || !action || action.id !== actionId || !serviceInstanceId)
      return;
    const result = await operation(() =>
      core.answerAsk({
        projectPath: snapshot().projectPath,
        serviceInstanceId,
        operationId: randomUUID(),
        runId: current.runId,
        actionId: action.id,
        answer,
      }),
    );
    if (result?.ok) setMode("run");
  }
  const resultOptions = () =>
    (run()?.results ?? [])
      .filter((item) => item.kind === "artifact" || item.kind === "record")
      .map((item, index) => ({
        name: `${item.kind}: ${item.id}`,
        description: `${item.stageName}/${item.stepName}${item.revision ? ` · revision ${item.revision}` : ""}`,
        value: String(index),
      }));
  async function showResult(index: string) {
    const item = (run()?.results ?? []).filter(
      (item) => item.kind === "artifact" || item.kind === "record",
    )[Number(index)];
    if (!item) return;
    if (item.kind === "artifact") {
      const result = await operation(() =>
        core.getArtifact({ ...input(), artifactId: item.id }),
      );
      if (result?.ok)
        setDetails(
          result.data?.revision === item.revision
            ? JSON.stringify(result.data, null, 2)
            : "historical_revision_unavailable: the current Artifact differs from this Run's committed revision.",
        );
    } else {
      const result = await operation(() =>
        core.getRecord({ ...input(), recordId: item.id }),
      );
      if (result?.ok) setDetails(JSON.stringify(result.data, null, 2));
    }
  }
  async function setting(value: string) {
    if (value === "add_package" || value === "remove_package") {
      setMode(value);
      return;
    }
    if (value === "edit_config") {
      const current = await operation(() => core.readProjectConfig(input()));
      if (current?.ok) {
        setConfigurationRevision(current.data.revision);
        setMode("edit_config");
      }
      return;
    }
    const result =
      value === "doctor"
        ? await operation(() => core.doctor(input()))
        : value === "config"
          ? await operation(() => core.readProjectConfig(input()))
          : value === "packages"
            ? await operation(() => core.listWorkflowPackages(input()))
            : value === "mcp"
              ? await operation<unknown>(async () => {
                  const plan = await core.planMcpConfig({
                    ...input(),
                    ide: "codex",
                  });
                  return plan.ok
                    ? core.applyMcpConfig({
                        ...input(),
                        ide: "codex",
                        beforeHash: plan.data.beforeHash,
                      })
                    : plan;
                })
              : value === "stop"
                ? await operation(() => core.stopService(input()))
                : undefined;
    if (result) setDetails(JSON.stringify(result, null, 2));
    if (value === "stop") await session.refresh();
  }
  return (
    <box flexDirection="column" width="100%" height="100%" padding={1}>
      <box flexDirection="column" height={4} border title="IntLoom">
        <text>{`${snapshot().projectPath} · ${snapshot().connection}${busy() ? " · working" : ""}`}</text>
        <text>
          {snapshot().instanceId
            ? `Instance ${snapshot().instanceId} · ${snapshot().runs.length} Runs`
            : "Select a project action to begin"}
        </text>
      </box>
      <box flexDirection="row" flexGrow={1}>
        <box flexDirection="column" flexGrow={1} border title={mode()}>
          <Show when={mode() === "home"}>
            <select
              flexGrow={1}
              focused
              options={homeOptions()}
              onSelect={(_index, option) => {
                void homeAction(String(option?.value));
              }}
            />
          </Show>
          <Show when={mode() === "flows"}>
            <select
              flexGrow={1}
              focused
              options={snapshot()
                .workflows.filter((flow) => flow.isAvailable)
                .map((flow) => ({
                  name: flow.flowName,
                  description: flow.readiness?.status ?? "",
                  value: flow.flowName,
                }))}
              onSelect={(_index, option) => {
                setSelectedFlow(String(option?.value));
                setMode("intent");
              }}
            />
            <text>Enter selects a Workflow. Ctrl+H returns home.</text>
          </Show>
          <Show
            when={[
              "intent",
              "init",
              "add_package",
              "remove_package",
              "edit_config",
            ].includes(mode())}
          >
            <text>
              {mode() === "intent"
                ? `Workflow ${selectedFlow()} · Ctrl+Enter submits complete intent`
                : mode() === "init"
                  ? "New or empty project path · Ctrl+Enter initializes"
                  : mode() === "add_package"
                    ? "Package/archive · Ctrl+Enter installs (Service must be stopped)"
                    : mode() === "remove_package"
                      ? "Declared package name · Ctrl+Enter removes (commits remain)"
                      : "Paste complete YAML · Ctrl+Enter saves for next Service start"}
            </text>
            <textarea
              flexGrow={1}
              focused
              ref={(value) => {
                editor = value;
              }}
              placeholder={
                mode() === "intent"
                  ? "Describe what you want to accomplish…"
                  : mode() === "init"
                    ? "./new-project"
                    : "Full input…"
              }
            />
          </Show>
          <Show when={mode() === "runs"}>
            <select
              flexGrow={1}
              focused
              options={snapshot().runs.map((item) => ({
                name: `${item.flowName} · ${item.status}`,
                description: `${item.runId} · ${item.cursor.stageName}/${item.cursor.stepName}`,
                value: item.runId,
              }))}
              onSelect={(_index, option) => {
                setSelectedRun(String(option?.value));
                setMode("run");
              }}
            />
          </Show>
          <Show when={mode() === "run"}>
            <scrollbox flexGrow={1}>
              <text>{runSummary()}</text>
              <text>
                {JSON.stringify(run()?.pendingAction?.request, null, 2) ?? ""}
              </text>
            </scrollbox>
            <select
              height={5}
              focused
              options={[
                ...(run()?.pendingAction
                  ? [
                      {
                        name: "Answer Workflow request",
                        value: "answer",
                        description: "",
                      },
                    ]
                  : []),
                {
                  name: "Committed results",
                  value: "results",
                  description: "",
                },
                ...(["running", "waiting"].includes(run()?.status ?? "")
                  ? [
                      {
                        name: "Cancel this Run",
                        value: "cancel",
                        description:
                          "Explicitly stop execution; prior commits remain",
                      },
                    ]
                  : []),
              ]}
              onSelect={(_index, option) => {
                void runAction(String(option?.value));
              }}
            />
          </Show>
          <Show when={mode() === "answer" && run()?.pendingAction?.id} keyed>
            {(actionId: string) => {
              const action = run()?.pendingAction;
              return action && action.id === actionId ? (
                <AnswerForm
                  action={action}
                  busy={busy()}
                  submit={submitAnswer}
                />
              ) : null;
            }}
          </Show>
          <Show when={mode() === "results"}>
            <select
              height={6}
              focused
              options={resultOptions()}
              onSelect={(_index, option) => {
                void showResult(String(option?.value));
              }}
            />
            <scrollbox flexGrow={1}>
              <text>{details()}</text>
            </scrollbox>
          </Show>
          <Show when={mode() === "settings"}>
            <select
              height={9}
              focused
              options={[
                { name: "Doctor", value: "doctor", description: "" },
                {
                  name: "Safe configuration",
                  value: "config",
                  description: "",
                },
                {
                  name: "Workflow packages",
                  value: "packages",
                  description: "",
                },
                {
                  name: "Add Workflow package",
                  value: "add_package",
                  description: "",
                },
                {
                  name: "Remove Workflow package",
                  value: "remove_package",
                  description: "",
                },
                {
                  name: "Edit startup configuration",
                  value: "edit_config",
                  description: "Full YAML",
                },
                { name: "Initialize Codex MCP", value: "mcp", description: "" },
                {
                  name: "Stop project Service",
                  value: "stop",
                  description: "Ends shared execution for all clients",
                },
              ]}
              onSelect={(_index, option) => {
                void setting(String(option?.value));
              }}
            />
            <scrollbox flexGrow={1}>
              <text>{details()}</text>
            </scrollbox>
          </Show>
        </box>
        <box
          width="32%"
          minWidth={22}
          flexDirection="column"
          border
          title="Current execution"
        >
          <text>{runProgress()}</text>
          <For each={run()?.activity ?? []}>
            {(activity) => (
              <text>{`${activity.kind}${activity.agentId ? ` · ${activity.agentId}` : ""}`}</text>
            )}
          </For>
          <text>{runMetrics()}</text>
        </box>
      </box>
      <text>{snapshot().message}</text>
      <text>
        Ctrl+H Home · Ctrl+N Workflows · Ctrl+L Runs · Ctrl+G Settings · Ctrl+R
        Refresh · Esc Exit
      </text>
    </box>
  );
}
function AnswerForm(props: {
  action: NonNullable<ServiceRunView["pendingAction"]>;
  busy: boolean;
  submit: (answer: ReadonlyJsonValue, actionId: string) => Promise<void>;
}) {
  const originalAction = props.action;
  const action = () => originalAction;
  const confirmation = () => action().kind === "user_ask_confirmation";
  const questions = () =>
    confirmation() ? [] : userAskQuestionsSchema.parse(action().request);
  const [index, setIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<ReadonlyJsonValue[]>([]);
  const [custom, setCustom] = createSignal(false);
  const [decision, setDecision] = createSignal<boolean | undefined>();
  const [message, setMessage] = createSignal("");
  let editor: TextareaRenderable | undefined;
  const question = () => questions()[index()];
  const finished = () => !confirmation() && index() >= questions().length;
  function next(answer: ReadonlyJsonValue) {
    setAnswers((items) => [...items, answer]);
    setIndex((value) => value + 1);
    setCustom(false);
  }
  async function send() {
    if (props.busy) return;
    if (confirmation()) {
      const isConfirmed = decision();
      if (isConfirmed === undefined) return;
      await props.submit(
        {
          isConfirmed,
          ...(editor?.plainText ? { feedback: editor.plainText } : {}),
        },
        action().id,
      );
    } else if (finished()) await props.submit(answers(), action().id);
    else {
      const current = question();
      const text = editor?.plainText ?? "";
      if (!current || !text.trim()) {
        setMessage(
          "Provide an answer, or explicitly skip an optional question.",
        );
        return;
      }
      next({ questionId: current.id, isSkipped: false, answer: text });
    }
  }
  useKeyboard((key) => {
    if (key.ctrl && key.name === "return") void send();
  });
  const choices = () => {
    const current = question();
    return current
      ? [
          ...(current.options ?? []).map((item, number) => ({
            name: item.label,
            description: item.description ?? "",
            value: String(number),
          })),
          { name: "Write an answer", value: "custom", description: "" },
          ...(current.isSkippable
            ? [
                {
                  name: "Skip this optional question",
                  value: "skip",
                  description: "",
                },
              ]
            : []),
        ]
      : [];
  };
  return (
    <box flexDirection="column" flexGrow={1}>
      <Show when={confirmation()}>
        <scrollbox flexGrow={1}>
          <text>
            {userAskConfirmationSchema.parse(action().request).context}
          </text>
        </scrollbox>
        <Show when={decision() === undefined}>
          <select
            flexGrow={1}
            focused
            height={4}
            options={[
              { name: "Confirm", value: "confirm", description: "" },
              { name: "Request changes", value: "revise", description: "" },
            ]}
            onSelect={(_i, choice) => setDecision(choice?.value === "confirm")}
          />
        </Show>
        <Show when={decision() !== undefined}>
          <text>
            {decision()
              ? "Confirm selected · Ctrl+Enter sends"
              : "Request changes · Enter feedback, then Ctrl+Enter sends"}
          </text>
          <textarea
            focused
            height={5}
            ref={(value) => {
              editor = value;
            }}
            placeholder="Optional feedback"
          />
        </Show>
      </Show>
      <Show when={!confirmation() && !finished()}>
        <text>{`${index() + 1}/${questions().length}: ${question()?.question}`}</text>
        <text>{question()?.description ?? ""}</text>
        <Show when={!custom()}>
          <select
            flexGrow={1}
            focused
            options={choices()}
            onSelect={(_i, choice) => {
              const current = question();
              if (!current) return;
              if (choice?.value === "custom") setCustom(true);
              else if (choice?.value === "skip")
                next({ questionId: current.id, isSkipped: true });
              else {
                const selected = current.options?.[Number(choice?.value)];
                if (selected)
                  next({
                    questionId: current.id,
                    isSkipped: false,
                    answer: selected.label,
                  });
              }
            }}
          />
        </Show>
        <Show when={custom()}>
          <textarea
            focused
            flexGrow={1}
            ref={(value) => {
              editor = value;
            }}
            placeholder="Full answer · Ctrl+Enter saves this answer"
          />
        </Show>
      </Show>
      <Show when={finished()}>
        <text>{JSON.stringify(answers(), null, 2)}</text>
        <select
          flexGrow={1}
          focused
          height={3}
          options={[
            { name: "Submit all answers", value: "send", description: "" },
            { name: "Review from beginning", value: "review", description: "" },
          ]}
          onSelect={(_i, choice) => {
            if (choice?.value === "send") void send();
            else {
              setIndex(0);
              setAnswers([]);
            }
          }}
        />
      </Show>
      <text>{message()}</text>
    </box>
  );
}
