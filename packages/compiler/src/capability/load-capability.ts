import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { findPackageJSON } from "node:module";
import * as z from "zod";
import {
  loomDefinitionSchema,
  workflowDefinitionSchema,
  schemaFromJson,
  type JsonSchema,
  type JsonValue,
} from "@intloom/loom-sdk";
import {
  compiledLoomProtocolVersion,
  type CompiledDefinition,
  type ExecutionPlan,
  type PlanStep,
  validateCompiledLoom,
} from "@intloom/loom-sdk/compiled";
import { parseYaml } from "../load/parse-document.ts";
import { validateDocument } from "../load/validate-document.ts";
import { metadataSchema, packageSchema } from "../source/schemas.ts";
import { isPathWithin, resolveReference } from "../source/references.ts";
import { collectSkillAssets } from "../load/collect-skill-assets.ts";
import type { ResourceAsset } from "../source/types.ts";
import type { ModuleReference } from "../analyze/model.ts";
import type { DistributionSource } from "../package/prepare-package.ts";
import { exists } from "../package/output-files.ts";
import { fail } from "../errors.ts";
import { collectApps } from "./apps.ts";

export interface CapabilitySource {
  root: string;
  definition: CompiledDefinition;
  plan: ExecutionPlan;
  manifest: DistributionSource;
  modules: Readonly<
    Record<
      string,
      {
        module: ModuleReference;
        kind: "code" | "check" | "tool" | "validator" | "continuation";
        input?: JsonSchema;
        output?: JsonSchema;
      }
    >
  >;
  assets: readonly ResourceAsset[];
}

export async function loadCapability(root: string): Promise<CapabilitySource> {
  const read = async (file: string) => {
    try {
      if (!isPathWithin(root, await realpath(file)))
        fail("INVALID_REFERENCE", "Resource escapes packageRoot", { file });
      return { file, text: await readFile(file, "utf8") };
    } catch (cause) {
      fail("SOURCE_READ_FAILED", "Unable to read resource", { file }, cause);
    }
  };
  const main = resolve(root, "loom.yaml");
  const document = parseYaml(await read(main));
  const source = validateDocument(loomDefinitionSchema, document);
  const modules: Record<
    string,
    {
      module: ModuleReference;
      kind: "code" | "check" | "tool" | "validator" | "continuation";
      input?: JsonSchema;
      output?: JsonSchema;
    }
  > = Object.create(null);
  const assets = new Map<string, ResourceAsset>();
  const schemaDocuments = new Map<string, JsonValue>();
  async function schema(
    value: JsonSchema,
    file = main,
    ancestry: readonly string[] = [],
  ): Promise<JsonSchema> {
    if (typeof value === "boolean") return value;
    const ref = value.$ref;
    if (ref !== undefined) {
      if (typeof ref !== "string")
        fail("INVALID_REFERENCE", "Schema $ref must be a string", { file });
      const [path, fragment = ""] = ref.split("#");
      if (path && !path.startsWith("./") && !path.startsWith("../"))
        fail(
          "INVALID_REFERENCE",
          "Only package-local Schema references are supported",
          { file },
        );
      const target = path ? resolve(dirname(file), path) : file;
      const key = `${target}#${fragment}`;
      if (ancestry.includes(key))
        fail(
          "INVALID_REFERENCE",
          "Recursive Schema references are not supported",
          { file },
        );
      let content = schemaDocuments.get(target);
      if (content === undefined) {
        if (target === main) content = z.json().parse(document.value);
        else {
          const text = await read(target);
          try {
            content = z.json().parse(JSON.parse(text.text));
          } catch (cause) {
            fail(
              "SOURCE_PARSE_FAILED",
              "Schema must contain JSON",
              { file: target },
              cause,
            );
          }
        }
        schemaDocuments.set(target, content);
      }
      let selected: unknown = content;
      if (fragment) {
        if (!fragment.startsWith("/"))
          fail("INVALID_REFERENCE", "Schema fragments must be JSON Pointers", {
            file,
          });
        for (const segment of fragment.slice(1).split("/")) {
          const key = decodeURIComponent(segment)
            .replaceAll("~1", "/")
            .replaceAll("~0", "~");
          if (
            !selected ||
            typeof selected !== "object" ||
            !Object.hasOwn(selected, key)
          )
            fail("INVALID_REFERENCE", `Missing Schema fragment: ${ref}`, {
              file,
            });
          selected = (selected as Record<string, unknown>)[key];
        }
      }
      const siblingKeys = Object.keys(value).filter(
        (key) => !["$ref", "title", "description", "$schema"].includes(key),
      );
      if (siblingKeys.length)
        fail(
          "INVALID_REFERENCE",
          "$ref siblings may only contain annotations",
          { file },
        );
      if (
        typeof selected !== "boolean" &&
        (!selected || typeof selected !== "object" || Array.isArray(selected))
      )
        fail("INVALID_REFERENCE", "Referenced value is not a Schema", { file });
      return schema(selected as JsonSchema, target, [...ancestry, key]);
    }
    const result: Record<string, JsonValue> = { ...value };
    for (const keyword of ["properties", "$defs"] as const) {
      const children = value[keyword];
      if (
        children &&
        typeof children === "object" &&
        !Array.isArray(children)
      ) {
        const resolved: Record<string, JsonValue> = Object.create(null);
        for (const [key, child] of Object.entries(children))
          resolved[key] = await schema(child as JsonSchema, file, ancestry);
        result[keyword] = resolved;
      }
    }
    for (const keyword of ["items", "additionalProperties"] as const)
      if (value[keyword] !== undefined)
        result[keyword] = await schema(
          value[keyword] as JsonSchema,
          file,
          ancestry,
        );
    for (const key of ["oneOf", "anyOf"] as const)
      if (Array.isArray(value[key]))
        result[key] = await Promise.all(
          value[key].map((child) =>
            schema(child as JsonSchema, file, ancestry),
          ),
        );
    try {
      schemaFromJson(result);
    } catch (cause) {
      fail(
        "INVALID_LOOM",
        `Invalid or unsupported Schema: ${cause instanceof Error ? cause.message : String(cause)}`,
        { file },
        cause,
      );
    }
    return result;
  }
  let manifest: DistributionSource;
  const packageFile = resolve(root, "package.json");
  const sdkFile = findPackageJSON("@intloom/loom-sdk", import.meta.url);
  if (!sdkFile)
    fail("INVALID_BUILD_CONFIG", "Compiler SDK metadata is unavailable");
  const sdk = JSON.parse(await readFile(sdkFile, "utf8")) as {
    version: string;
  };
  if (await exists(packageFile)) {
    let value: unknown;
    try {
      value = JSON.parse((await read(packageFile)).text);
    } catch (cause) {
      fail(
        "SOURCE_PARSE_FAILED",
        "Invalid package.json",
        { file: packageFile },
        cause,
      );
    }
    if (value && typeof value === "object" && "loom" in value)
      fail(
        "INVALID_LOOM",
        "Both loom.yaml and package.json.loom are defined; choose one source format",
        { file: main },
      );
    const parsed = packageSchema.omit({ loom: true }).safeParse(value);
    if (!parsed.success)
      fail(
        "INVALID_LOOM",
        "Invalid source package metadata",
        { file: packageFile },
        parsed.error,
      );
    if (parsed.data.version !== source.version)
      fail(
        "INVALID_LOOM",
        "package.json version must match loom.yaml version",
        { file: main },
      );
    manifest = {
      ...parsed.data,
      loom: { type: "loom", version: compiledLoomProtocolVersion },
    };
  } else {
    const parsed = packageSchema.omit({ loom: true }).safeParse({
      name: source.name,
      version: source.version,
      type: "module",
    });
    if (!parsed.success)
      fail(
        "INVALID_LOOM",
        "Provide package.json with a valid npm name for this Loom",
        { file: main },
        parsed.error,
      );
    manifest = {
      ...parsed.data,
      loom: { type: "loom", version: compiledLoomProtocolVersion },
    };
  }
  manifest = {
    ...manifest,
    dependencies: {
      "@intloom/loom-sdk": sdk.version,
      ...manifest.dependencies,
    },
  };
  async function module(
    ref: string,
    kind: "code" | "check" | "tool" | "validator" | "continuation",
    from = main,
    input?: JsonSchema,
    output?: JsonSchema,
  ) {
    const resolved = resolveReference(
      root,
      ref,
      kind === "tool" ? "tool" : "code",
      from,
    );
    await read(resolved.file);
    const key = JSON.stringify([
      manifest.name,
      relative(root, resolved.file),
      resolved.exportName,
      kind,
      input,
      output,
    ]);
    const id = createHash("sha256")
      .update(key)
      .digest("base64url")
      .slice(0, 21);
    modules[id] = {
      module: {
        sourceFile: resolved.file,
        exportName: resolved.exportName,
        location: { file: from },
      },
      kind,
      ...(input === undefined ? {} : { input }),
      ...(output === undefined ? {} : { output }),
    };
    return id;
  }
  const definition: CompiledDefinition = {
    name: source.name,
    version: source.version,
    description: source.description,
    input: await schema(source.input),
    output: await schema(source.output),
    agents: {},
    interactions: {},
    acceptance: { checks: [] },
    ...(source.presentation ? { presentation: source.presentation } : {}),
  };
  if (source.apps) {
    const collected = await collectApps(root, source.apps);
    definition.apps = collected.apps;
    for (const asset of collected.assets) assets.set(asset.outputPath, asset);
  }
  for (const [id, interaction] of Object.entries(source.interactions)) {
    definition.interactions[id] = {
      ...interaction,
      ...(interaction.validate
        ? { validate: await module(interaction.validate, "validator") }
        : {}),
      context: await schema(interaction.context),
      ...(interaction.kind === "confirm"
        ? {}
        : { response: await schema(interaction.response) }),
    };
  }
  for (const [id, agent] of Object.entries(source.agents)) {
    const resolved = resolveReference(root, agent.definition, "agent", main);
    const markdown = await read(resolved.file);
    const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
      markdown.text,
    );
    if (!match?.[1])
      fail("SOURCE_PARSE_FAILED", "Agent Markdown requires YAML frontmatter", {
        file: resolved.file,
      });
    const meta = validateDocument(
      metadataSchema,
      parseYaml(markdown, match[1], markdown.text.indexOf("\n") + 1),
    );
    const skills = [];
    for (const ref of agent.skills) {
      const skill = resolveReference(root, ref, "skill", main);
      const text = await read(skill.file);
      const head = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
        text.text,
      );
      if (!head?.[1])
        fail("SOURCE_PARSE_FAILED", "Skill requires YAML frontmatter", {
          file: skill.file,
        });
      const metadata = validateDocument(
        metadataSchema,
        parseYaml(text, head[1], text.text.indexOf("\n") + 1),
      );
      const files = await collectSkillAssets(root, skill.file);
      for (const asset of files) assets.set(asset.outputPath, asset);
      skills.push({
        ...metadata,
        content: text.text.slice(head[0].length).trim(),
        assets: files.map((asset) => asset.outputPath),
      });
    }
    definition.agents[id] = {
      ...meta,
      instructions: markdown.text.slice(match[0].length).trim(),
      modelProfile: agent.modelProfile,
      ...(agent.resume
        ? { resume: await module(agent.resume, "continuation") }
        : {}),
      input:
        agent.input === undefined
          ? definition.input
          : await schema(agent.input),
      output:
        agent.output === undefined
          ? definition.output
          : await schema(agent.output),
      interactions: agent.interactions,
      skills,
      tools: await Promise.all(agent.tools.map((ref) => module(ref, "tool"))),
    };
  }
  const steps: PlanStep[] = [];
  const sourceLocation = (file: string, pointer?: string) => ({
    file: relative(root, file).replaceAll("\\", "/"),
    ...(pointer ? { pointer } : {}),
  });
  let result: import("@intloom/loom-sdk").ValueBinding = { from: "execute" };
  if ("workflow" in source.execute) {
    const file = resolve(dirname(main), source.execute.workflow);
    const doc = parseYaml(await read(file));
    const workflow = validateDocument(workflowDefinitionSchema, doc);
    for (const [index, step] of workflow.steps.entries()) {
      if ("agent" in step.execute) {
        const declaration = source.agents[step.execute.agent];
        if (
          declaration &&
          (declaration.input === undefined || declaration.output === undefined)
        )
          fail(
            "INVALID_LOOM",
            `Workflow Agent ${step.execute.agent} must declare its own input and output`,
            { file },
          );
      }
      const common = {
        id: step.id,
        input: step.input,
        ...(step.when ? { when: step.when } : {}),
        source: sourceLocation(file, `/steps/${index}`),
      };
      steps.push(
        "code" in step.execute
          ? {
              ...common,
              kind: "code",
              binding: await module(step.execute.code, "code", file),
            }
          : { ...common, kind: "agent", agent: step.execute.agent },
      );
    }
    result = workflow.output;
  } else {
    const common = {
      id: "execute",
      input: { from: "input" },
      source: sourceLocation(main, "/execute"),
    };
    steps.push(
      "code" in source.execute
        ? {
            ...common,
            kind: "code",
            binding: await module(
              source.execute.code,
              "code",
              main,
              definition.input,
              definition.output,
            ),
          }
        : { ...common, kind: "agent", agent: source.execute.agent },
    );
  }
  steps.push({
    id: "$output",
    kind: "output",
    input: result,
    source: sourceLocation(main, "/output"),
  });
  for (const [index, check] of (source.acceptance?.checks ?? []).entries()) {
    const binding = await module(check.code, "check");
    definition.acceptance.checks.push({
      id: check.id,
      binding,
      ...(check.description ? { description: check.description } : {}),
    });
    steps.push({
      id: `$check-${check.id}`,
      kind: "check",
      check: check.id,
      source: sourceLocation(main, `/acceptance/checks/${index}`),
    });
  }
  if (source.acceptance?.confirmation) {
    definition.acceptance.confirmation = source.acceptance.confirmation;
    steps.push({
      id: "$confirmation",
      kind: "confirm",
      interaction: source.acceptance.confirmation,
      source: sourceLocation(main, "/acceptance/confirmation"),
    });
  }
  steps.push({ id: "$deliver", kind: "deliver", source: sourceLocation(main) });
  const plan = { steps };
  // Validate references against inert bindings. Actual exports are verified statically after TypeScript emission.
  const placeholder = () => {
    throw new Error("Analysis must not execute bindings");
  };
  try {
    validateCompiledLoom({
      definition,
      plan,
      bindings: {
        validators: Object.fromEntries(
          Object.entries(modules)
            .filter(([, item]) => item.kind === "validator")
            .map(([id]) => [id, placeholder]),
        ),
        continuations: Object.fromEntries(
          Object.entries(modules)
            .filter(([, item]) => item.kind === "continuation")
            .map(([id]) => [id, placeholder]),
        ),
        codes: Object.fromEntries(
          Object.entries(modules)
            .filter(([, item]) => item.kind === "code")
            .map(([id]) => [id, placeholder]),
        ),
        checks: Object.fromEntries(
          Object.entries(modules)
            .filter(([, item]) => item.kind === "check")
            .map(([id]) => [id, placeholder]),
        ),
        tools: Object.fromEntries(
          Object.entries(modules)
            .filter(([, item]) => item.kind === "tool")
            .map(([id]) => [
              id,
              {
                id,
                description: "Analysis placeholder",
                inputSchema: z.unknown(),
                outputSchema: z.unknown(),
                execute: placeholder,
              },
            ]),
        ),
      },
    });
  } catch (cause) {
    fail(
      "INVALID_LOOM",
      cause instanceof Error ? cause.message : "Invalid capability",
      { file: main },
      cause,
    );
  }
  return {
    root,
    definition,
    plan,
    modules,
    manifest,
    assets: [...assets.values()],
  };
}
