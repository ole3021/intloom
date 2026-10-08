import { LoomError } from "@intloom/utils";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fail } from "../errors.ts";
import type { CompileOptions } from "../types.ts";
import type {
  SourceDocument,
  SourceResource,
  SourceSet,
  SourceText,
} from "../source/types.ts";
import { isPathWithin, resolveReference } from "../source/references.ts";
import { parseYaml } from "./parse-document.ts";

async function readSource(root: string, file: string): Promise<SourceText> {
  try {
    const canonical = await realpath(file);
    if (!isPathWithin(root, canonical))
      fail("INVALID_REFERENCE", "Resource resolves outside packageRoot", {
        file,
      });
    return { file, text: await readFile(file, "utf8") };
  } catch (cause) {
    if (LoomError.is(cause)) throw cause;
    fail("SOURCE_READ_FAILED", "Unable to read source", { file }, cause);
  }
}

export async function loadSources(options: CompileOptions): Promise<SourceSet> {
  let root: string;
  try {
    root = await realpath(resolve(options.packageRoot));
  } catch (cause) {
    fail(
      "SOURCE_READ_FAILED",
      "Invalid packageRoot",
      { file: options.packageRoot },
      cause,
    );
  }
  const packageSource = await readSource(root, resolve(root, "package.json"));
  let packageValue: unknown;
  try {
    packageValue = JSON.parse(packageSource.text) as unknown;
  } catch (cause) {
    fail(
      "SOURCE_PARSE_FAILED",
      "Invalid package.json",
      { file: packageSource.file },
      cause,
    );
  }
  const resources: SourceResource[] = [];
  const visited = new Set<string>();
  const pending: { file: string; kind: SourceResource["kind"] }[] = [
    { file: resolve(root, "workflow.yaml"), kind: "workflow" },
  ];
  function references(
    value: unknown,
    document: SourceDocument,
    pointer = "",
    referenceValue = false,
  ): void {
    if (
      referenceValue &&
      typeof value === "string" &&
      /^@(stages|agents|skills|codes|schemas|tools|initializers)\//.test(value)
    ) {
      try {
        pending.push(resolveReference(root, value));
      } catch (cause) {
        fail(
          "INVALID_REFERENCE",
          `Invalid resource reference: ${value}`,
          document.locations[pointer] ?? { file: document.source.file },
          cause,
        );
      }
    } else if (Array.isArray(value))
      value.forEach((item, index) => {
        references(item, document, `${pointer}/${index}`, referenceValue);
      });
    else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        references(
          item,
          document,
          `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          [
            "stage",
            "schema",
            "initialize",
            "code",
            "agent",
            "outputSchema",
            "skills",
            "tools",
          ].includes(key),
        );
      });
    }
  }
  while (pending.length) {
    const item = pending.shift();
    if (!item || visited.has(item.file)) continue;
    visited.add(item.file);
    const source = await readSource(root, item.file);
    if (item.kind === "workflow" || item.kind === "stage") {
      const document = parseYaml(source);
      resources.push({ kind: item.kind, document });
      references(document.value, document);
    } else if (item.kind === "agent" || item.kind === "skill") {
      const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
        source.text,
      );
      if (!match || match[1] === undefined)
        fail("SOURCE_PARSE_FAILED", "Markdown requires YAML frontmatter", {
          file: source.file,
        });
      const offset = source.text.indexOf("\n") + 1;
      const metadata = parseYaml(source, match[1], offset);
      resources.push({
        kind: item.kind,
        metadata,
        content: source.text.slice(match[0].length).trim(),
      });
    } else resources.push({ kind: item.kind, source });
  }
  return {
    options: { ...options, packageRoot: root },
    packageJson: {
      source: packageSource,
      value: packageValue,
      locations: { "": { file: packageSource.file } },
    },
    resources,
  };
}
