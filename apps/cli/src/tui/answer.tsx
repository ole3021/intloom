import { createSignal, Show, onCleanup } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import {
  userAskQuestionsSchema,
  userAskConfirmationSchema,
  type ReadonlyJsonValue,
} from "@intloom/kernel";
import type { ServiceRunView } from "../core/index.ts";
import { Composer } from "./widgets.tsx";
import { useTransitionAccent } from "./motion.ts";

export interface AnswerDraft {
  index: number;
  answers: ReadonlyJsonValue[];
  texts: Record<number, string>;
  custom: boolean;
  decision?: boolean | undefined;
  feedback: string;
}
export const emptyAnswerDraft = (): AnswerDraft => ({
  index: 0,
  answers: [],
  texts: {},
  custom: false,
  feedback: "",
});

export function AnswerForm(props: {
  action: NonNullable<ServiceRunView["pendingAction"]>;
  draft: AnswerDraft;
  focused: boolean;
  save: (draft: AnswerDraft) => void;
  submit: (answer: ReadonlyJsonValue, actionId: string) => void;
  commands: (query: string) => void;
}) {
  const action = props.action;
  const confirmation = action.kind === "user_ask_confirmation";
  const questions = confirmation
    ? []
    : userAskQuestionsSchema.parse(action.request);
  const [draft, setDraft] = createSignal(props.draft);
  const accent = useTransitionAccent(
    () => `${action.id}/${draft().index}/${draft().decision}`,
  );
  const question = () => questions[draft().index];
  const finished = () => !confirmation && draft().index >= questions.length;
  function update(patch: Partial<AnswerDraft>) {
    const next = { ...draft(), ...patch };
    setDraft(next);
    props.save(next);
  }
  onCleanup(() => props.save(draft()));
  function next(answer: ReadonlyJsonValue) {
    const answers = [...draft().answers];
    answers[draft().index] = answer;
    update({ answers, index: draft().index + 1, custom: false });
  }
  function send() {
    if (!props.focused) return;
    if (confirmation && draft().decision !== undefined)
      props.submit(
        {
          isConfirmed: draft().decision as boolean,
          ...(draft().feedback ? { feedback: draft().feedback } : {}),
        },
        action.id,
      );
    else if (finished()) props.submit(draft().answers, action.id);
    else {
      const current = question(),
        text = draft().texts[draft().index] ?? "";
      if (current && text.trim())
        next({ questionId: current.id, isSkipped: false, answer: text });
    }
  }
  useKeyboard((key) => {
    if (key.defaultPrevented || !props.focused) return;
    if (!key.ctrl && key.name === "escape") {
      key.preventDefault();
      if (confirmation) update({ decision: undefined });
      else update({ index: Math.max(0, draft().index - 1), custom: false });
    } else if (
      key.sequence === "/" &&
      !(confirmation ? draft().decision !== undefined : draft().custom)
    ) {
      key.preventDefault();
      key.stopPropagation();
      props.commands("/");
    }
  });
  return (
    <box
      flexDirection="column"
      flexShrink={0}
      border
      title="Waiting for your answer"
      borderColor={accent()}
      paddingX={1}
    >
      <Show when={confirmation}>
        <scrollbox height={3} scrollX={false}>
          <text flexShrink={0}>
            {confirmation
              ? userAskConfirmationSchema.parse(action.request).context
              : ""}
          </text>
        </scrollbox>
        <Show when={draft().decision === undefined}>
          <select
            height={3}
            focused={props.focused}
            options={[
              { name: "Confirm", value: "confirm", description: "" },
              { name: "Request changes", value: "revise", description: "" },
            ]}
            onSelect={(_i, choice) => {
              if (props.focused)
                update({ decision: choice?.value === "confirm" });
            }}
          />
        </Show>
        <Show when={draft().decision !== undefined}>
          <text flexShrink={0}>
            {draft().decision ? "Confirm selected" : "Request changes selected"}
          </text>
          <Composer
            commands={props.commands}
            value={draft().feedback}
            focused={props.focused}
            height={3}
            placeholder="Optional feedback · Enter submits"
            change={(feedback) => update({ feedback })}
            submit={send}
          />
        </Show>
      </Show>
      <Show when={!confirmation && !finished()}>
        <text
          flexShrink={0}
        >{`${draft().index + 1}/${questions.length}: ${question()?.question}`}</text>
        <text flexShrink={0} fg="#9299a5">
          {question()?.description ?? ""}
        </text>
        <Show when={!draft().custom}>
          <select
            height={4}
            focused={props.focused}
            options={[
              ...(question()?.options ?? []).map((option, index) => ({
                name: option.label,
                description: option.description ?? "",
                value: String(index),
              })),
              { name: "Write an answer", description: "", value: "custom" },
              ...(question()?.isSkippable
                ? [
                    {
                      name: "Skip this optional question",
                      description: "",
                      value: "skip",
                    },
                  ]
                : []),
            ]}
            onSelect={(_i, choice) => {
              const current = question();
              if (!props.focused || !current) return;
              if (choice?.value === "custom") update({ custom: true });
              else if (choice?.value === "skip")
                next({ questionId: current.id, isSkipped: true });
              else {
                const option = current.options?.[Number(choice?.value)];
                if (option)
                  next({
                    questionId: current.id,
                    isSkipped: false,
                    answer: option.label,
                  });
              }
            }}
          />
        </Show>
        <Show when={draft().custom}>
          <Composer
            commands={props.commands}
            value={draft().texts[draft().index] ?? ""}
            focused={props.focused}
            placeholder="Your answer · Enter saves this answer"
            height={3}
            change={(text) =>
              update({ texts: { ...draft().texts, [draft().index]: text } })
            }
            submit={send}
          />
        </Show>
      </Show>
      <Show when={finished()}>
        <scrollbox height={4} scrollX={false}>
          <text flexShrink={0}>{JSON.stringify(draft().answers, null, 2)}</text>
        </scrollbox>
        <select
          height={3}
          focused={props.focused}
          options={[
            { name: "Submit all answers", value: "send", description: "" },
            { name: "Review from beginning", value: "review", description: "" },
          ]}
          onSelect={(_i, choice) => {
            if (!props.focused) return;
            if (choice?.value === "send") send();
            else update({ index: 0, custom: false });
          }}
        />
      </Show>
      <text flexShrink={0} fg="#9299a5">
        Enter Continue · Shift+Enter New line · Esc Previous · / Commands
      </text>
    </box>
  );
}
