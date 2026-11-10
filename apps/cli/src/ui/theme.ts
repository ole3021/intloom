import { version } from "../metadata.ts";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { styleText, stripVTControlCharacters } from "node:util";
import wrapAnsi from "wrap-ansi";
import stringWidth from "string-width";
import { isPlainOutput } from "./output-mode.ts";

export function terminalColors(stream: NodeJS.WriteStream) {
  return Boolean(
    !isPlainOutput() &&
      stream.isTTY &&
      !process.env.CI &&
      process.env.TERM !== "dumb" &&
      process.env.NO_COLOR === undefined,
  );
}

export function paint(
  stream: NodeJS.WriteStream,
  format: "bold" | "dim" | "green" | "yellow" | "red" | "cyan",
  text: string,
) {
  return terminalColors(stream) ? styleText(format, text, { stream }) : text;
}

export function displayPath(path: string) {
  const absolute = resolve(path);
  const home = homedir();
  return absolute === home
    ? "~"
    : absolute.startsWith(home + sep)
      ? `~${absolute.slice(home.length)}`
      : absolute;
}

export function wrapText(text: string, stream: NodeJS.WriteStream) {
  if (isPlainOutput()) return stripVTControlCharacters(text);
  return wrapAnsi(text, Math.max(1, (stream.columns || 80) - 1), {
    hard: true,
    trim: false,
  });
}

export function heading(stream: NodeJS.WriteStream, suffix = "") {
  return `${paint(stream, "bold", "Intloom")} ${paint(stream, "dim", version)}${suffix ? ` · ${suffix}` : ""}`;
}

export function pathLine(
  label: string,
  path: string,
  stream: NodeJS.WriteStream,
  details = false,
) {
  let value = displayPath(path);
  const prefix = label.padEnd(9);
  const width = Math.max(4, (stream.columns || 80) - prefix.length - 1);
  if (
    stream.isTTY &&
    !isPlainOutput() &&
    !details &&
    stringWidth(value) > width
  ) {
    const chars = [...value];
    let left = "",
      right = "";
    while (
      chars.length &&
      stringWidth(left + chars[0]) <= Math.floor((width - 1) / 3)
    )
      left += chars.shift();
    while (
      chars.length &&
      stringWidth(`${left}…${chars.at(-1)}${right}`) <= width
    )
      right = chars.pop() + right;
    value = `${left}…${right}`;
  }
  return prefix + value;
}
