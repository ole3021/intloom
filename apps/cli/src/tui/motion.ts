import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { primaryColor } from "./theme.ts";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Activity only: no fabricated progress, and no timer for idle/terminal Runs. */
export function useActivity(active: () => boolean) {
  const enabled = createMemo(active);
  const [frame, setFrame] = createSignal(0);
  createEffect(() => {
    if (!enabled()) return;
    const timer = setInterval(
      () => setFrame((value) => (value + 1) % frames.length),
      120,
    );
    timer.unref();
    onCleanup(() => clearInterval(timer));
  });
  return () => (enabled() ? frames[frame()] : " ");
}

/** Brief focus fade keeps geometry and selection stable during screen changes. */
export function useTransitionAccent(selection: () => string) {
  const key = createMemo(selection);
  const [color, setColor] = createSignal(primaryColor);
  createEffect(() => {
    key();
    setColor("#a6f3a6");
    const middle = setTimeout(() => setColor("#70e370"), 80);
    const finish = setTimeout(() => setColor(primaryColor), 180);
    middle.unref();
    finish.unref();
    onCleanup(() => {
      clearTimeout(middle);
      clearTimeout(finish);
    });
  });
  return color;
}
