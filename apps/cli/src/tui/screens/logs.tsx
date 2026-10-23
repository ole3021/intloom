import { createSignal, For, onCleanup, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { CliCore } from "../../core/index.ts";
import { formatLog } from "../../shared/presentation/logs.ts";

export function RunLogs(props: {
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
