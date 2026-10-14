import { createEffect, createSignal, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { TextareaRenderable, KeyBinding } from "@opentui/core";
import { useTransitionAccent } from "./motion.ts";
import { primaryColor } from "./theme.ts";

export const submitBindings: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "j", ctrl: true, action: "newline" },
];

export function Composer(props: {
  value: string;
  focused: boolean;
  placeholder: string;
  change: (value: string) => void;
  submit: (value: string) => void;
  height?: number;
  commands?: (query: string) => void;
}) {
  let editor: TextareaRenderable | undefined;
  createEffect(() => {
    props.focused;
    if (editor && editor.plainText !== props.value) editor.setText(props.value);
  });
  return (
    <textarea
      ref={(value) => {
        editor = value;
      }}
      initialValue={props.value}
      height={props.height ?? 4}
      focused={props.focused}
      cursorColor={primaryColor}
      wrapMode="char"
      placeholder={props.placeholder}
      keyBindings={submitBindings}
      onContentChange={() => {
        const value = editor?.plainText ?? "";
        if (
          props.focused &&
          props.commands &&
          value.startsWith("/") &&
          !value.includes("\n")
        )
          props.commands(value);
        else props.change(value);
      }}
      onSubmit={() => props.submit(editor?.plainText ?? "")}
    />
  );
}

export interface Choice {
  id: string;
  name: string;
  description: string;
  disabled?: boolean;
}

/** One focused input owns typing; global handlers consume dialog navigation. */
export function Picker(props: {
  title: string;
  choices: readonly Choice[];
  select: (id: string, query: string) => void;
  hint?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = createSignal(props.initialQuery ?? "");
  const [index, setIndex] = createSignal(0);
  const accent = useTransitionAccent(() => props.title);
  let highlighted: string | undefined;
  const choices = () =>
    props.choices.filter((item) =>
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(
          (props.initialQuery?.startsWith("/")
            ? (query().split(/\s+/)[0] ?? "")
            : query()
          ).toLowerCase(),
        ),
    );
  createEffect(() => {
    const available = choices();
    const previous = available.findIndex((item) => item.id === highlighted);
    setIndex(previous >= 0 ? previous : 0);
  });
  useKeyboard((key) => {
    if (key.defaultPrevented) return;
    if (["up", "down", "return"].includes(key.name)) {
      key.preventDefault();
      key.stopPropagation();
      if (key.name === "up") setIndex((value) => Math.max(0, value - 1));
      else if (key.name === "down")
        setIndex((value) =>
          Math.max(0, Math.min(choices().length - 1, value + 1)),
        );
      else {
        const selected = choices()[index()];
        if (selected && !selected.disabled) props.select(selected.id, query());
      }
      highlighted = choices()[index()]?.id;
    }
  });
  const start = () => Math.max(0, index() - 5);
  return (
    <box
      flexDirection="column"
      border
      borderColor={accent()}
      title={props.title}
      padding={1}
    >
      <input
        focused
        cursorColor={primaryColor}
        value={query()}
        placeholder="Type to filter…"
        onInput={(value) => {
          highlighted = undefined;
          setQuery(value);
        }}
      />
      <For each={choices().slice(start(), start() + 7)}>
        {(item, offset) => (
          <box
            flexDirection="column"
            backgroundColor={
              start() + offset() === index() ? "#193b24" : "#18212e"
            }
          >
            <text
              flexShrink={0}
              fg={item.disabled ? "#9299a5" : "#e5e9f0"}
            >{`${start() + offset() === index() ? "›" : " "} ${item.name}`}</text>
            <text flexShrink={0} fg="#9299a5">
              {item.description}
            </text>
          </box>
        )}
      </For>
      <text flexShrink={0}>
        {choices().length
          ? (props.hint ?? "↑/↓ Select · Enter Open · Esc Back")
          : "No matches"}
      </text>
    </box>
  );
}

export function displayStatus(run: { status: string; stopReason?: string }) {
  return run.stopReason === "user_cancel" ? "cancelled" : run.status;
}
