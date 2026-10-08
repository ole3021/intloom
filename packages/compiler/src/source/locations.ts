import type { SourceDocument, SourceLocation } from "./types.ts";

function pointer(path: readonly PropertyKey[]): string {
  return path
    .map((key) => `/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`)
    .join("");
}
export function sourceLocation(
  document: SourceDocument,
  path: readonly PropertyKey[] = [],
): SourceLocation {
  for (let length = path.length; length >= 0; length--) {
    const found = document.locations[pointer(path.slice(0, length))];
    if (found) return found;
  }
  return { file: document.source.file };
}
