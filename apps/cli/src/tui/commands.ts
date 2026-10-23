import type { Accessor } from "solid-js";
import type { ServiceRunView } from "../core/index.ts";
import type { TuiSnapshot } from "./session.ts";
import type { Choice } from "./components/widgets.tsx";
import type { Dialog } from "./navigation.ts";
import { runnable, unfinished } from "./selectors.ts";
interface CommandContext {
  snapshot: Accessor<TuiSnapshot>;
  run: Accessor<ServiceRunView | undefined>;
  connected: () => boolean;
  canWrite: () => boolean;
  controlTarget: Accessor<ServiceRunView | undefined>;
  setCommand: (text: string) => void;
  setDialog: (dialog: Dialog | undefined) => void;
  newRun: (loomName?: string) => void;
  openControl: (kind: "cancel" | "resume") => void;
  quit: () => void;
  message: (text: string) => void;
}
export function createCommands(context: CommandContext) {
  const {
    snapshot,
    run,
    connected,
    canWrite,
    controlTarget,
    setCommand,
    setDialog,
    newRun,
    openControl,
    quit,
    message,
  } = context;
  function executeCommand(text: string) {
    const [name, ...args] = text.split(/\s+/);
    setCommand("");
    setDialog(undefined);
    switch (name) {
      case "/run":
        newRun(args.join(" ") || undefined);
        break;
      case "/loom":
        setDialog("looms");
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
        quit();
        break;
      default:
        message("Unknown command. Type / to see the six available commands.");
    }
  }
  const commands = (): Choice[] => [
    {
      id: "/run",
      name: "/run",
      description: canWrite()
        ? "Create a new Loom input draft"
        : "Unavailable while Service is disconnected or an operation is pending",
      disabled: !canWrite(),
    },
    {
      id: "/loom",
      name: "/loom",
      description: connected()
        ? "Choose Loom for a new Run · Ctrl+P"
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
  const loomChoices = (): Choice[] =>
    snapshot().looms.map((item, index) => ({
      id: String(index),
      name: item.loomName ?? item.packageName,
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
          id: "loom",
          name: "Continue Loom",
          description: "Continue to completion or the next user action",
        },
      ],
      ...(control.pauseReason === "mirror_capture_failed"
        ? [
            {
              id: "abandon",
              name: "Continue Loom without mirror capture",
              description:
                "Explicitly abandon further mirror capture for this Run",
            },
          ]
        : []),
    ];
  };
  return { executeCommand, commands, loomChoices, resumeChoices };
}
