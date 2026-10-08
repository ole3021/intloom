import { isAlias, isMap, isNode, isScalar, isSeq, parseDocument } from "yaml";
import { fail } from "../errors.ts";
import type {
  SourceDocument,
  SourceLocation,
  SourceText,
} from "../source/types.ts";

function position(source: SourceText, offset: number): SourceLocation {
  const lines = source.text.slice(0, offset).split(/\r?\n/);
  return {
    file: source.file,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

export function parseYaml(
  source: SourceText,
  text = source.text,
  offset = 0,
): SourceDocument {
  const document = parseDocument(text, { uniqueKeys: true, version: "1.2" });
  const error = document.errors[0] ?? document.warnings[0];
  if (error)
    fail(
      "SOURCE_PARSE_FAILED",
      error.message,
      position(source, offset + error.pos[0]),
      error,
    );
  const locations: Record<string, SourceLocation> = Object.create(null);
  function visit(node: unknown, pointer: string): void {
    if (isAlias(node))
      fail(
        "SOURCE_PARSE_FAILED",
        "YAML aliases are not supported",
        position(source, offset + (node.range?.[0] ?? 0)),
      );
    locations[pointer] = position(
      source,
      offset + (isNode(node) ? (node.range?.[0] ?? 0) : 0),
    );
    if (isMap(node)) {
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string")
          fail(
            "SOURCE_PARSE_FAILED",
            "Mapping keys must be strings",
            locations[pointer],
          );
        const key = pair.key.value;
        if (["__proto__", "prototype", "constructor"].includes(key))
          fail(
            "SOURCE_PARSE_FAILED",
            `Reserved key: ${key}`,
            locations[pointer],
          );
        const child = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
        visit(pair.value, child);
        locations[child] = position(
          source,
          offset + (pair.key.range?.[0] ?? 0),
        );
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => {
        visit(item, `${pointer}/${index}`);
      });
    }
  }
  visit(document.contents, "");
  return {
    source,
    value: document.toJS({ maxAliasCount: 0 }) as unknown,
    locations,
  };
}
