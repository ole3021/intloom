import type { Accessor } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { TuiSnapshot } from "./session.ts";
import type { PendingWrite } from "./actions.ts";
import { runnable } from "./selectors.ts";
export type Dialog = "looms" | "runs" | "commands" | "cancel" | "resume";
export const windows = ["workbench", "logs", "resources"] as const;
export type TuiWindow = (typeof windows)[number];
interface NavigationContext {
  dialog: Accessor<Dialog | undefined>;
  setDialog: (dialog: Dialog | undefined) => void;
  view: Accessor<TuiWindow>;
  setView: (view: TuiWindow) => void;
  connected: () => boolean;
  pending: Accessor<PendingWrite | undefined>;
  selectedRun: Accessor<string | undefined>;
  snapshot: Accessor<TuiSnapshot>;
  openCommands: () => void;
}
export function useNavigationKeys(context: NavigationContext) {
  const {
    dialog,
    setDialog,
    view,
    setView,
    connected,
    pending,
    selectedRun,
    snapshot,
    openCommands,
  } = context;
  useKeyboard((key) => {
    if (key.defaultPrevented) return;
    if (dialog()) {
      if (key.name === "escape") {
        key.preventDefault();
        key.stopPropagation();
        setDialog(undefined);
      } else if (key.name === "tab") {
        key.preventDefault();
        key.stopPropagation();
      }
      return;
    }
    if (key.name === "tab" && !key.ctrl) {
      key.preventDefault();
      key.stopPropagation();
      setView(
        windows[(windows.indexOf(view()) + 1) % windows.length] ?? "workbench",
      );
    } else if (key.ctrl && ["o", "p"].includes(key.name)) {
      key.preventDefault();
      key.stopPropagation();
      setDialog(key.name === "o" ? "runs" : "looms");
    } else if (
      key.sequence === "/" &&
      (view() === "logs" ||
        !connected() ||
        pending() ||
        (!selectedRun() && !snapshot().looms.some(runnable)))
    ) {
      key.preventDefault();
      key.stopPropagation();
      openCommands();
    }
  });
}
