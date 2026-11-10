import { remainingRows } from "./layout.ts";
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { liveOutput } from "./live.ts";
import { paint, wrapText } from "./theme.ts";
import { bindOutput } from "./output-mode.ts";

type Text = string | ((stream: NodeJS.WriteStream) => string);
type Header = string | ((elapsed: number | undefined) => string);

// Keep the complete transcript on disk; only recent entries belong in the view.
export function logPage(
  stream: NodeJS.WriteStream,
  dataDir: string,
  name: string,
  animated = true,
  transcriptPath?: string,
) {
  const directory = join(dataDir, "logs");
  if (!transcriptPath) mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const path =
    transcriptPath ??
    join(
      directory,
      `${name.replaceAll(/[^a-z0-9_-]/gi, "_")}-${stamp}-${process.pid}.log`,
    );
  const file = transcriptPath ? undefined : openSync(path, "a", 0o600);
  const plain = {
    isTTY: false,
    columns: Number.MAX_SAFE_INTEGER,
  } as NodeJS.WriteStream;
  const ui = liveOutput(stream, animated, true);
  const entries: Text[] = [];
  let header: Header = "";
  let lines: string[] = [];
  let columns = stream.columns;
  let dirty = false;
  let pending: ReturnType<typeof setImmediate> | undefined;
  let first = true;
  const renderText = (text: Text, target: NodeJS.WriteStream) =>
    typeof text === "function" ? text(target) : text;
  const rebuild = () => {
    columns = stream.columns;
    dirty = false;
    lines = entries.flatMap((entry) =>
      wrapText(renderText(entry, stream), stream).split("\n"),
    );
  };
  const frame = (elapsed?: number) => {
    if (dirty || columns !== stream.columns) rebuild();
    const rows = remainingRows(stream, "", { minimum: 1 });
    const top = wrapText(
      typeof header === "function" ? header(elapsed) : header,
      stream,
    )
      .split("\n")
      .slice(0, Math.max(1, rows - 3));
    const available = Math.max(0, rows - top.length - 1);
    const label = paint(
      stream,
      "dim",
      "── Recent logs · full history in Log ──",
    );
    const divider = wrapText(label, stream).split("\n")[0] ?? "";
    return [
      ...top,
      divider,
      ...(available
        ? lines.length
          ? lines.slice(-available)
          : [paint(stream, "dim", "No log entries yet")]
        : []),
    ].join("\n");
  };
  const draw = () => {
    if (ui.dynamic) ui.frame(typeof header === "function" ? frame : frame());
  };
  stream.on("resize", draw);
  return {
    dynamic: ui.dynamic,
    path,
    frame: bindOutput((next: Header) => {
      header = next;
      if (first) {
        const text = typeof header === "function" ? header(undefined) : header;
        if (file !== undefined)
          writeSync(file, `${stripVTControlCharacters(text)}\n\n`);
        if (!ui.dynamic) ui.line(text);
        first = false;
      }
      draw();
    }),
    line: bindOutput((text: Text) => {
      if (file !== undefined)
        writeSync(
          file,
          `${stripVTControlCharacters(renderText(text, plain))}\n`,
        );
      if (ui.dynamic) {
        entries.push(text);
        if (entries.length > 200) entries.shift();
        dirty = true;
        pending ??= setImmediate(() => {
          pending = undefined;
          draw();
        });
      } else ui.line(renderText(text, stream));
    }),
    close: bindOutput((keep = true) => {
      if (pending) {
        clearImmediate(pending);
        draw();
      }
      stream.off("resize", draw);
      ui.close(keep);
      if (file !== undefined) closeSync(file);
    }),
  };
}
