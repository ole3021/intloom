import { wrapText } from "./theme.ts";

export function lineCount(text: string, stream: NodeJS.WriteStream) {
  return text ? wrapText(text, stream).split("\n").length : 0;
}

// Reserve the terminal's final row to avoid scrolling a live frame.
export function remainingRows(
  stream: NodeJS.WriteStream,
  fixed = "",
  options: { reserved?: number; minimum?: number } = {},
) {
  return Math.max(
    options.minimum ?? 0,
    (stream.rows || 24) -
      1 -
      lineCount(fixed, stream) -
      (options.reserved ?? 0),
  );
}
