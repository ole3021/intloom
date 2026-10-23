import { LoomError } from "@intloom/utils";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fail } from "../errors.ts";
import type { CompileOptions } from "../types.ts";
import type {
  SourceDocument,
  SourceLocation,
  SourceReference,
  SourceResource,
  SourceSet,
  SourceText,
} from "../source/types.ts";
import {
  isPathWithin,
  resolveReference,
  type ResourceKind,
} from "../source/references.ts";
import {
  metadataSchema,
  packageSchema,
  stageSchema,
} from "../source/schemas.ts";
import { sourceLocation } from "../source/locations.ts";
import { parseYaml } from "./parse-document.ts";
import { validateDocument } from "./validate-document.ts";
import { collectSkillAssets } from "./collect-skill-assets.ts";

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
  let value: unknown;
  try {
    value = JSON.parse(packageSource.text);
  } catch (cause) {
    fail(
      "SOURCE_PARSE_FAILED",
      "Invalid package.json",
      { file: packageSource.file },
      cause,
    );
  }
  // JSON is parsed strictly; the YAML reader supplies node locations and duplicate-key checks.
  const document = { ...parseYaml(packageSource), value };
  const packageJson = {
    ...document,
    value: validateDocument(packageSchema, document),
  };
  const resources: SourceResource[] = [];
  const references: SourceReference[] = [];
  const visited = new Set<string>();
  const pending: SourceReference[] = [];
  function add(
    reference: string,
    kind: ResourceKind,
    document: SourceDocument,
    path: readonly (string | number)[],
    scope: Pick<SourceLocation, "stageName" | "stepName"> = {},
  ) {
    const location = { ...sourceLocation(document, path), ...scope };
    try {
      const item = {
        ...resolveReference(root, reference, kind, document.source.file),
        fromFile: document.source.file,
        reference,
        location,
      };
      references.push(item);
      pending.push(item);
    } catch (cause) {
      fail(
        "INVALID_REFERENCE",
        `Invalid resource reference: ${reference}`,
        location,
        cause,
      );
    }
  }
  for (const [name, stage] of Object.entries(packageJson.value.loom.stages))
    add(stage.stage, "stage", packageJson, ["loom", "stages", name, "stage"], {
      stageName: name,
    });
  for (let index = 0; index < pending.length; index++) {
    const item = pending[index];
    if (!item || visited.has(`${item.kind}:${item.file}`)) continue;
    visited.add(`${item.kind}:${item.file}`);
    const source = await readSource(root, item.file);
    if (item.kind === "stage") {
      const parsed = parseYaml(source);
      const document = {
        ...parsed,
        value: validateDocument(stageSchema, parsed),
      };
      const stage = document.value.stage;
      const scope = { stageName: stage.name };
      resources.push({ kind: "stage", document });
      add(
        stage.state.schema,
        "schema",
        document,
        ["stage", "state", "schema"],
        scope,
      );
      add(
        stage.state.initialize,
        "initializer",
        document,
        ["stage", "state", "initialize"],
        scope,
      );
      for (const [stepName, step] of Object.entries(stage.steps)) {
        const scope = { stageName: stage.name, stepName };
        const path = ["stage", "steps", stepName];
        if (step.type === "code")
          add(step.code, "code", document, [...path, "code"], scope);
        else {
          add(step.agent, "agent", document, [...path, "agent"], scope);
          add(
            step.outputSchema,
            "schema",
            document,
            [...path, "outputSchema"],
            scope,
          );
          step.skills.forEach((ref, i) => {
            add(ref, "skill", document, [...path, "skills", i], scope);
          });
          step.tools.forEach((ref, i) => {
            add(ref, "tool", document, [...path, "tools", i], scope);
          });
        }
      }
    } else if (item.kind === "agent" || item.kind === "skill") {
      const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
        source.text,
      );
      if (!match || match[1] === undefined)
        fail("SOURCE_PARSE_FAILED", "Markdown requires YAML frontmatter", {
          file: source.file,
        });
      const parsed = parseYaml(source, match[1], source.text.indexOf("\n") + 1);
      const metadata = {
        ...parsed,
        value: validateDocument(metadataSchema, parsed),
      };
      const content = source.text.slice(match[0].length).trim();
      resources.push(
        item.kind === "skill"
          ? {
              kind: "skill",
              metadata,
              content,
              assets: await collectSkillAssets(root, item.file),
            }
          : { kind: "agent", metadata, content },
      );
    } else resources.push({ kind: item.kind, source });
  }
  return {
    options: { ...options, packageRoot: root },
    packageJson,
    resources,
    references,
  };
}
