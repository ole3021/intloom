import type { JsonValue } from "@intloom/loom-sdk";
import wrapAnsi from "wrap-ansi";
import { clockTime } from "./live.ts";
import { paint } from "./theme.ts";
import { isPlainOutput } from "./output-mode.ts";
import { stripVTControlCharacters } from "node:util";

export interface ServiceLogEntry {
  level: string;
  message: string;
  time?: string | undefined;
  runId?: string | undefined;
  loomId?: string | undefined;
  componentId?: string | undefined;
  data?: JsonValue | undefined;
}

export function formatServiceLog(
  entry: ServiceLogEntry,
  stream: NodeJS.WriteStream,
) {
  if (isPlainOutput())
    return stripVTControlCharacters(
      [
        entry.time ?? new Date().toISOString(),
        entry.level.toUpperCase(),
        entry.runId ?? "service",
        entry.loomId,
        entry.componentId ? `[${entry.componentId}]` : undefined,
        entry.message,
        entry.data === undefined
          ? undefined
          : `data=${JSON.stringify(entry.data)}`,
      ]
        .filter((part) => part !== undefined)
        .join(" "),
    );
  const columns = Math.max(1, (stream.columns || 80) - 1);
  const fields = (
    [
      [clockTime(entry.time ?? new Date().toISOString()), 8],
      [entry.level.toUpperCase(), 5],
      [entry.runId ?? "—", 6],
      [entry.loomId ?? (entry.runId ? "—" : "service"), 18],
    ] as const
  ).map(([value, width]) => ({
    width,
    lines: wrapAnsi(value, width, { hard: true, wordWrap: false }).split("\n"),
  }));
  const prefixWidth = fields.reduce((sum, field) => sum + field.width + 2, 0);
  const inline = columns - prefixWidth >= 24;
  const indent = inline ? prefixWidth : 2;
  const levelColor =
    entry.level === "error"
      ? "red"
      : entry.level === "warn"
        ? "yellow"
        : "cyan";
  const headers = Array.from(
    { length: Math.max(...fields.map((field) => field.lines.length)) },
    (_, row) =>
      fields
        .map((field, column) => {
          const value = (field.lines[row] ?? "").padEnd(field.width);
          return column === 0
            ? paint(stream, "dim", value)
            : column === 1
              ? paint(stream, levelColor, value)
              : value;
        })
        .join("  "),
  );
  const content = (text: string, baseIndent: number) =>
    text.split("\n").flatMap((line) => {
      const leading = line.search(/[^ ]|$/);
      const padding = " ".repeat(
        Math.min(baseIndent + leading, Math.max(0, columns - 2)),
      );
      return wrapAnsi(line.slice(leading), columns - padding.length, {
        hard: true,
      })
        .split("\n")
        .map((part) => padding + part);
    });
  const message = entry.componentId
    ? `${paint(stream, "dim", `[${entry.componentId}]`)} ${entry.message}`
    : entry.message;
  const body = content(message, indent);
  const lines = inline
    ? Array.from(
        { length: Math.max(headers.length, body.length) },
        (_, row) =>
          (headers[row] ?? " ".repeat(prefixWidth - 2)) +
          "  " +
          (body[row]?.slice(indent) ?? ""),
      )
    : [
        ...headers.map((header) =>
          wrapAnsi(header.trimEnd(), columns, { hard: true }),
        ),
        ...body,
      ];
  if (entry.data !== undefined)
    lines.push(...content(JSON.stringify(entry.data, null, 2), indent + 2));
  return lines.map((line) => line.trimEnd()).join("\n");
}

export function serviceLog(service: string, message: string) {
  process.stderr.write(
    `${clockTime(new Date().toISOString())}  [${service}] ${message}\n`,
  );
}
