import { loomInputHint } from "../loom-input.ts";
import { For, Show, type Accessor } from "solid-js";
import type { ServiceRunView } from "../../core/index.ts";
import { Composer, displayStatus } from "../components/widgets.tsx";
import { AnswerForm } from "../components/answer.tsx";
import { primaryColor } from "../theme.ts";
import type { TuiController } from "../controller.ts";
import { runnable, unfinished } from "../selectors.ts";
import { RunLogs } from "./logs.tsx";
import { RunStatus } from "../components/run-status.tsx";
export function RunScreen(props: { controller: TuiController }) {
  const {
    core,
    dimensions,
    snapshot,
    view,
    selectedRun,
    loom,
    draft,
    setDraft,
    command,
    setCommand,
    run,
    canWrite,
    focused,
    accent,
    drafts,
    getDraft,
    openCommands,
    submitDraft,
    answer,
    executeCommand,
  } = props.controller;
  return (
    <box flexGrow={1} flexDirection="row" visible={view() !== "resources"}>
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
                    No Run selected. Ctrl+O selects a Run to view its logs.
                  </text>
                }
              >
                <text flexShrink={0} fg={primaryColor}>
                  I N T L O O M
                </text>
                <text flexShrink={0}>What would you like this Loom to do?</text>
                <Show
                  when={snapshot().looms.some(runnable)}
                  fallback={
                    <box flexDirection="column">
                      <text>
                        No runnable Loom. Ctrl+P shows Loom readiness.
                      </text>
                      <For each={snapshot().looms}>
                        {(item) => (
                          <text fg="#ecc77b">{`${item.loomName ?? item.packageName}: ${item.isAvailable ? (item.readiness?.error?.message ?? item.readiness?.status ?? "available") : item.error.message}`}</text>
                        )}
                      </For>
                      <text>Use CMD for package and model configuration.</text>
                    </box>
                  }
                >
                  <box
                    flexDirection="column"
                    border
                    title="Loom inputs"
                    borderColor={accent()}
                    paddingX={1}
                  >
                    <Composer
                      value={draft()}
                      change={setDraft}
                      submit={submitDraft}
                      commands={openCommands}
                      focused={
                        focused() && canWrite() && view() === "workbench"
                      }
                      placeholder={loomInputHint(
                        (() => {
                          const selected = snapshot().looms.find(
                            (item) => item.loomName === loom(),
                          );
                          return selected?.isAvailable
                            ? selected.inputs
                            : (["prompt"] as const);
                        })(),
                      )}
                    />
                    <text
                      flexShrink={0}
                      fg={primaryColor}
                    >{`Loom: ${loom() || "Choose a Loom"} · Ctrl+P Select`}</text>
                    <text flexShrink={0} fg="#9299a5">
                      Enter Submit · Shift+Enter New line · Long text wraps
                      automatically
                    </text>
                  </box>
                </Show>
              </Show>
            </box>
          }
        >
          <text
            flexShrink={0}
          >{`${run()?.loomName ?? "Run"} · ${selectedRun()} · ${run() ? displayStatus(run() as ServiceRunView) : "Loading Run…"}`}</text>
          <Show when={run()}>
            {(current: Accessor<ServiceRunView>) => (
              <>
                <text
                  flexShrink={0}
                  fg="#9299a5"
                >{`${current().cursor.stageName}/${current().cursor.stepName} · revision ${current().revision}${current().control?.pauseReason ? ` · ${current().control?.pauseReason}` : ""}`}</text>
                <Show when={dimensions().width < 100 && view() === "workbench"}>
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
                <box flexDirection="column" visible={view() === "workbench"}>
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
                            focused() && canWrite() && view() === "workbench"
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
          Boolean(run()) && dimensions().width >= 100 && view() === "workbench"
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
  );
}
