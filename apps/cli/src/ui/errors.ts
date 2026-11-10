import { stripVTControlCharacters } from "node:util";
import type { ExecutionError } from "@intloom/loom-sdk";
import { paint, wrapText } from "./theme.ts";
import { isPlainOutput } from "./output-mode.ts";

export function diagnosticBlock(
  title: string,
  content: string,
  stream: NodeJS.WriteStream = process.stderr,
) {
  if (isPlainOutput())
    return `${title}\n${stripVTControlCharacters(content).replaceAll("\r", "")}`;
  const rule = "─".repeat(
    Math.max(1, Math.min(72, (stream.columns || 80) - 1)),
  );
  return [
    paint(stream, "red", rule),
    paint(stream, "red", title),
    wrapText(stripVTControlCharacters(content).replaceAll("\r", ""), stream),
    paint(stream, "red", rule),
  ].join("\n");
}

export function errorBlock(
  error: ExecutionError,
  stream: NodeJS.WriteStream = process.stderr,
  full = true,
) {
  const details = error.details;
  const original =
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    typeof details.stack === "string"
      ? details
      : undefined;
  const compiler =
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    Array.isArray(details.diagnostics)
      ? details.diagnostics
      : undefined;
  return diagnosticBlock(
    `Error · ${error.businessCode ?? error.code}`,
    [
      ...(error.businessCode ? [`Code  ${error.code}`] : []),
      error.message,
      ...(error.origin
        ? [
            `Origin  ${error.origin.stepPath?.join("/") ?? error.origin.componentId}`,
          ]
        : []),
      ...(error.details === undefined
        ? []
        : original
          ? [
              "",
              "Original error",
              full
                ? String(original.stack)
                : String(original.stack).split(/\n\s+at /)[0],
              ...(typeof original.cause === "string"
                ? ["Caused by", original.cause]
                : []),
            ]
          : compiler
            ? [
                "",
                "Compiler diagnostics",
                ...compiler.map((item) =>
                  item && typeof item === "object" && !Array.isArray(item)
                    ? [
                        `${item.stage} · ${item.code}`,
                        item.message,
                        item.path,
                        item.componentId,
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : JSON.stringify(item),
                ),
              ]
            : ["", "Details", JSON.stringify(error.details, null, 2)]),
    ].join("\n"),
    stream,
  );
}
