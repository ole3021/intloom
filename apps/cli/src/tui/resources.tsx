import { createEffect, createSignal, Show, onCleanup, untrack } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { CliCore, ServiceRunView } from "../core/index.ts";
import { useActivity, useTransitionAccent } from "./motion.ts";

interface ResourceRow {
  id: string;
  flowName: string;
  stageName: string;
  revision?: number;
  removed?: boolean;
  description: string;
}

export function Resources(props: {
  core: CliCore;
  projectPath: string;
  instanceId: string;
  run: ServiceRunView | undefined;
  focused: boolean;
  back: () => void;
  commands: (query: string) => void;
}) {
  const [kind, setKind] = createSignal<"artifact" | "record">("artifact");
  const [scope, setScope] = createSignal<"project" | "run">(
    props.run ? "run" : "project",
  );
  const [rows, setRows] = createSignal<ResourceRow[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [text, setText] = createSignal("");
  const [flow, setFlow] = createSignal("");
  const [stage, setStage] = createSignal("");
  const [filter, setFilter] = createSignal<number>();
  const [actions, setActions] = createSignal(false);
  const [details, setDetails] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const activity = useActivity(busy);
  const accent = useTransitionAccent(
    () => `${kind()}/${scope()}/${details() !== undefined}`,
  );
  let generation = 0,
    disposed = false;
  let viewer: ScrollBoxRenderable | undefined;
  const input = () => ({
    projectPath: props.projectPath,
    serviceInstanceId: props.instanceId,
  });
  const filtered = () =>
    rows().filter(
      (row) =>
        (!flow() || row.flowName === flow()) &&
        (!stage() || row.stageName === stage()) &&
        `${row.id} ${row.description}`
          .toLowerCase()
          .includes(text().toLowerCase()),
    );
  async function load(more = false) {
    const current = ++generation;
    setDetails(undefined);
    setMessage("");
    if (!more) {
      setRows([]);
      setCursor(undefined);
    }
    if (scope() === "run") {
      const run = props.run;
      setRows(
        (run?.results ?? [])
          .filter(
            (item) => item.kind === kind() || item.kind === `removed_${kind()}`,
          )
          .map((item) => ({
            id: item.id,
            flowName: run?.flowName ?? "",
            stageName: item.stageName,
            ...(item.revision === undefined ? {} : { revision: item.revision }),
            removed: item.kind.startsWith("removed_"),
            description: `${item.stageName}/${item.stepName} · ${item.committedAt}${item.revision ? ` · revision ${item.revision}` : ""}${item.kind.startsWith("removed_") ? " · removed" : ""}`,
          })),
      );
      setBusy(false);
      return;
    }
    setBusy(true);
    const nextCursor = cursor();
    const query = {
      limit: 50,
      ...(flow() ? { flowName: flow() } : {}),
      ...(stage() ? { stageName: stage() } : {}),
      ...(more && nextCursor ? { cursor: nextCursor } : {}),
    };
    const result =
      kind() === "artifact"
        ? await props.core.listArtifacts({ ...input(), query })
        : await props.core.listRecords({ ...input(), query });
    if (disposed || current !== generation) return;
    setBusy(false);
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setCursor(result.data.nextCursor);
    setRows((previous) => [
      ...(more ? previous : []),
      ...result.data.data.map((item) => ({
        id: item.id,
        flowName: item.flowName,
        stageName: item.stageName,
        ...("revision" in item ? { revision: item.revision } : {}),
        description: `${item.flowName}/${item.stageName} · ${item.createdAt}${"revision" in item ? ` · revision ${item.revision}` : ""}`,
      })),
    ]);
  }
  // Keep the Run result list current without reading or changing execution state.
  let selection = "";
  createEffect(() => {
    const key = JSON.stringify([
      scope(),
      kind(),
      props.instanceId,
      scope() === "run" ? props.run?.results : null,
    ]);
    if (selection === key) return;
    selection = key;
    untrack(() => {
      void load();
    });
  });
  onCleanup(() => {
    disposed = true;
    generation++;
  });
  async function open(row: ResourceRow) {
    const current = ++generation;
    if (row.removed) {
      setDetails(`${row.id}\nThis resource was removed by the Run.`);
      return;
    }
    setBusy(true);
    const result =
      kind() === "artifact"
        ? await props.core.getArtifact({ ...input(), artifactId: row.id })
        : await props.core.getRecord({ ...input(), recordId: row.id });
    if (disposed || current !== generation) return;
    setBusy(false);
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    if (result.data === null)
      setDetails(`${row.id}\nResource is no longer available.`);
    else if (
      scope() === "run" &&
      row.revision !== undefined &&
      "revision" in result.data &&
      result.data.revision !== row.revision
    )
      setDetails(
        `historical_revision_unavailable\n${row.id}: Run committed revision ${row.revision}; current revision is ${result.data.revision}.\nThe original content cannot be retrieved.`,
      );
    else setDetails(JSON.stringify(result.data, null, 2));
  }
  useKeyboard((key) => {
    if (key.defaultPrevented || !props.focused) return;
    if (
      key.name === "escape" &&
      (details() !== undefined || filter() !== undefined)
    ) {
      key.preventDefault();
      key.stopPropagation();
      if (filter() !== undefined) {
        setFilter(undefined);
        void load();
      } else setDetails(undefined);
    } else if (key.name === "escape") {
      key.preventDefault();
      props.back();
    } else if (key.sequence === "/" && filter() === undefined) {
      key.preventDefault();
      key.stopPropagation();
      props.commands("/");
    } else if (
      ["left", "right"].includes(key.name) &&
      filter() === undefined &&
      details() === undefined &&
      !key.ctrl
    ) {
      key.preventDefault();
      key.stopPropagation();
      setActions(key.name === "left");
    } else if (
      ["up", "down"].includes(key.name) &&
      filter() !== undefined &&
      !key.ctrl
    ) {
      key.preventDefault();
      setFilter(((filter() ?? 0) + (key.name === "up" ? 2 : 1)) % 3);
    } else if (key.name === "return" && filter() !== undefined) {
      key.preventDefault();
      setFilter(undefined);
      void load();
    } else if (
      details() !== undefined &&
      ["pageup", "pagedown", "up", "down"].includes(key.name)
    ) {
      key.preventDefault();
      viewer?.scrollBy(
        key.name === "pageup"
          ? -10
          : key.name === "pagedown"
            ? 10
            : key.name === "up"
              ? -1
              : 1,
      );
    }
  });
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      border
      borderColor={accent()}
      title="Assets"
      paddingX={1}
    >
      <text
        flexShrink={0}
      >{`${kind() === "artifact" ? "Artifacts" : "Records"} · ${scope() === "run" ? `Run ${props.run?.runId ?? "none"}` : "All project resources"}`}</text>
      <Show
        when={actions() && filter() === undefined && details() === undefined}
      >
        <select
          height={4}
          focused={props.focused}
          options={[
            {
              name: `Switch to ${kind() === "artifact" ? "Records" : "Artifacts"}`,
              value: "kind",
              description: "",
            },
            {
              name: `Scope: ${scope() === "run" ? "project" : "current Run"}`,
              value: "scope",
              description: "",
            },
            {
              name: "Filter resources",
              value: "filter",
              description: "Workflow, Stage and text",
            },
            { name: "Refresh resources", value: "refresh", description: "" },
          ]}
          onSelect={(_i, option) => {
            if (!props.focused || busy()) return;
            setActions(false);
            if (option?.value === "kind")
              setKind(kind() === "artifact" ? "record" : "artifact");
            else if (option?.value === "scope")
              setScope(scope() === "run" || !props.run ? "project" : "run");
            else if (option?.value === "filter") setFilter(0);
            else if (option?.value === "refresh") void load();
          }}
        />
      </Show>
      <Show when={filter() !== undefined}>
        <text flexShrink={0}>
          Filters · Flow and Stage require exact names · Text searches loaded
          entries
        </text>
        <input
          value={flow()}
          focused={props.focused && filter() === 0}
          placeholder="Workflow (empty = all)"
          onInput={setFlow}
        />
        <input
          value={stage()}
          focused={props.focused && filter() === 1}
          placeholder="Stage (empty = all)"
          onInput={setStage}
        />
        <input
          value={text()}
          focused={props.focused && filter() === 2}
          placeholder="Resource ID or metadata"
          onInput={setText}
        />
        <text flexShrink={0}>
          ↑/↓ Select field · Enter Apply · Esc Apply and return
        </text>
      </Show>
      <Show
        when={details() === undefined}
        fallback={
          <scrollbox
            ref={(value) => {
              viewer = value;
            }}
            flexGrow={1}
            scrollX={false}
          >
            <text flexShrink={0}>{details()}</text>
          </scrollbox>
        }
      >
        <text
          flexShrink={0}
          fg="#9299a5"
        >{`Flow: ${flow() || "all"} · Stage: ${stage() || "all"} · Text: ${text() || "all"} · ${filtered().length}/${rows().length} loaded`}</text>
        <Show when={!busy() && !filtered().length}>
          <text flexShrink={0}>No resources match this scope and filters.</text>
        </Show>
        <select
          flexGrow={1}
          focused={
            props.focused && !actions() && filter() === undefined && !busy()
          }
          options={[
            ...filtered().map((row, index) => ({
              name: row.id,
              value: String(index),
              description: row.description,
            })),
            ...(cursor()
              ? [
                  {
                    name: "Load next page",
                    value: "more",
                    description: "50 more resources",
                  },
                ]
              : []),
          ]}
          onSelect={(_i, option) => {
            if (!props.focused || busy()) return;
            if (option?.value === "more") void load(true);
            else {
              const row = filtered()[Number(option?.value)];
              if (row) void open(row);
            }
          }}
        />
      </Show>
      <text flexShrink={0}>
        {busy() ? `${activity()} Loading…` : message()}
      </text>
      <text flexShrink={0} fg="#9299a5">
        ← Actions · → List · Enter Open · Esc Back · / Commands
      </text>
    </box>
  );
}
