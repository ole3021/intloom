import { For, Show } from "solid-js";
import type { CliCore } from "../core/index.ts";
import { Resources } from "./screens/resources.tsx";
import { primaryColor } from "./theme.ts";
import { createTuiController } from "./controller.ts";
import { RunScreen } from "./screens/run.tsx";
import { Dialogs } from "./dialogs/index.tsx";
export function App(props: { projectPath: string; core?: CliCore }) {
  const controller = createTuiController(props);
  const {
    core,
    session,
    snapshot,
    windows,
    view,
    setView,
    assetsVisited,
    dialog,
    busy,
    pending,
    run,
    focused,
    activity,
    openCommands,
    check,
  } = controller;
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
          <RunScreen controller={controller} />
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
          <text>/ for commands · Ctrl+O Run · Ctrl+P Loom</text>
        </box>
      </Show>
      <text flexShrink={0} maxHeight={2}>
        {snapshot().message}
      </text>
      <text flexShrink={0} fg="#9299a5">
        Tab Run / Logs / Assets · / Commands · Ctrl+O Run · Ctrl+P Loom
      </text>
      <Dialogs controller={controller} />
    </box>
  );
}
