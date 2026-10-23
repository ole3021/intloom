import { Show } from "solid-js";
import { Picker, displayStatus } from "../components/widgets.tsx";
import type { TuiController } from "../controller.ts";
import type { Dialog } from "../navigation.ts";
import { runnable, newest } from "../selectors.ts";
export function Dialogs(props: { controller: TuiController }) {
  const {
    snapshot,
    dialog,
    setDialog,
    commandQuery,
    controlTarget,
    newRun,
    selectRun,
    cancel,
    resume,
    executeCommand,
    commands,
    loomChoices,
    resumeChoices,
  } = props.controller;
  return (
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
              mode === "looms"
                ? "Choose Loom for a new Run"
                : mode === "runs"
                  ? "Switch Run"
                  : mode === "cancel"
                    ? `Stop ${controlTarget()?.runId}?`
                    : mode === "resume"
                      ? `Continue paused Run · ${controlTarget()?.control?.pauseReason ?? "paused"}`
                      : "Commands · MVP"
            }
            choices={
              mode === "looms"
                ? loomChoices()
                : mode === "runs"
                  ? newest(snapshot().runs).map((item) => ({
                      id: item.runId,
                      name: `${item.loomName} · ${displayStatus(item)}`,
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
              if (mode === "looms") {
                const item = snapshot().looms[Number(id)];
                if (item?.loomName && runnable(item)) newRun(item.loomName);
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
  );
}
