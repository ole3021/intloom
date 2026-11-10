import { createLogUpdate } from "log-update";
import ansiEscapes from "ansi-escapes";
import wrapAnsi from "wrap-ansi";
import { activityMark, animationInterval, type Activity } from "./activity.ts";
import { paint, wrapText } from "./theme.ts";
import { isPlainOutput, bindOutput } from "./output-mode.ts";

type Frame = string | ((elapsed: number | undefined) => string);

// Persistent milestones and the current frame share one output owner.
export function liveOutput(
  stream: NodeJS.WriteStream,
  animated = true,
  screen = false,
) {
  const render =
    animated &&
    !isPlainOutput() &&
    stream.isTTY &&
    !process.env.CI &&
    process.env.TERM !== "dumb"
      ? createLogUpdate(stream, { showCursor: true })
      : undefined;
  let previous = "";
  let columns = stream.columns;
  let rows = stream.rows;
  let frame: Frame = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let screenActive = false;
  const started = Date.now();
  const resized = () => {
    if (!render || (columns === stream.columns && rows === stream.rows)) return;
    // Terminals reflow the old frame before emitting resize; log-update retains its old line count.
    if (previous && !screen) {
      const reflowed = wrapAnsi(
        previous.endsWith("\n") ? previous : `${previous}\n`,
        stream.columns || 80,
        { hard: true, trim: false, wordWrap: false },
      );
      stream.write(
        ansiEscapes.eraseLines(
          Math.min(stream.rows || 24, reflowed.split("\n").length),
        ),
      );
    }
    render.done();
    previous = "";
    columns = stream.columns;
    rows = stream.rows;
  };
  const draw = () => {
    resized();
    const text = wrapText(
      typeof frame === "function"
        ? frame(render ? Date.now() - started : undefined)
        : frame,
      stream,
    );
    if (text === previous) return;
    previous = text;
    if (render && screen) {
      if (!screenActive) {
        stream.write(
          ansiEscapes.enterAlternativeScreen + ansiEscapes.cursorHide,
        );
        screenActive = true;
      }
      // The alternate screen has no scrollback to reflow into the current page.
      stream.write(
        ansiEscapes.cursorTo(0, 0) +
          text.replaceAll("\n", `${ansiEscapes.eraseEndLine}\n`) +
          ansiEscapes.eraseDown,
      );
    } else if (render) render(text);
    else stream.write(`${text}\n`);
  };
  return {
    dynamic: Boolean(render),
    line: bindOutput((text: string) => {
      if (screen) {
        clearInterval(timer);
        timer = undefined;
        if (screenActive) {
          stream.write(
            ansiEscapes.exitAlternativeScreen + ansiEscapes.cursorShow,
          );
          screenActive = false;
        }
        frame = "";
        previous = "";
        stream.write(`${wrapText(text, stream)}\n`);
        return;
      }
      if (render) {
        resized();
        previous = "";
        render.persist(wrapText(text, stream));
        if (frame !== "") draw();
      } else stream.write(`${wrapText(text, stream)}\n`);
    }),
    frame: bindOutput((next: Frame) => {
      frame = next;
      if (render && typeof next === "function") {
        timer ??= setInterval(draw, animationInterval);
        timer.unref();
      } else {
        clearInterval(timer);
        timer = undefined;
      }
      draw();
    }),
    close: bindOutput((keep = false) => {
      clearInterval(timer);
      if (screenActive) {
        stream.write(
          ansiEscapes.exitAlternativeScreen + ansiEscapes.cursorShow,
        );
        screenActive = false;
        if (keep && previous) stream.write(`${previous}\n`);
        frame = "";
        previous = "";
        return;
      }
      resized();
      if (!keep) render?.clear();
      render?.done();
      frame = "";
    }),
  };
}

export function progress(
  message: string,
  kind: Activity = "working",
  animated = true,
) {
  const stream = process.stderr;
  const view = liveOutput(stream, animated && Boolean(process.stdout.isTTY));
  view.frame((elapsed) =>
    `${activityMark(kind, elapsed, stream)} ${message}`.trimStart(),
  );
  return {
    close(result?: string) {
      view.close();
      if (result)
        view.line(
          isPlainOutput() ? result : `${paint(stream, "green", "✓")} ${result}`,
        );
    },
  };
}
export const clockTime = (time: string) =>
  new Date(time).toLocaleTimeString("en-GB", { hour12: false });
