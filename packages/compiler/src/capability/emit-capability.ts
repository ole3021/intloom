import { relative } from "node:path";
import type { JsonSchema } from "@intloom/loom-sdk";
import type { GeneratedEntry } from "../emit/generate-entry.ts";
import type { CapabilitySource } from "./load-capability.ts";

function schemaType(schema: JsonSchema): string {
  if (schema === false) return "never";
  if (schema === true) return 'import("@intloom/loom-sdk").JsonValue';
  for (const key of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(schema[key])) {
      const { [key]: variants, ...base } = schema;
      return `(${schemaType(base)}) & (${(variants as JsonSchema[]).map(schemaType).join(" | ")})`;
    }
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum))
    return (
      schema.enum.map((value) => JSON.stringify(value)).join(" | ") || "never"
    );
  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `Array<${schemaType((schema.items ?? true) as JsonSchema)}>`;
    case "object": {
      const properties =
        schema.properties &&
        typeof schema.properties === "object" &&
        !Array.isArray(schema.properties)
          ? schema.properties
          : {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      const fields = Object.entries(properties)
        .map(
          ([key, child]) =>
            `${JSON.stringify(key)}${required.includes(key) ? "" : "?"}: ${schemaType(child as JsonSchema)}`,
        )
        .join("; ");
      return `{ ${fields} }${schema.additionalProperties === false ? "" : ' & Record<string, import("@intloom/loom-sdk").JsonValue>'}`;
    }
    default:
      return 'import("@intloom/loom-sdk").JsonValue';
  }
}

export function emitCapability(
  source: CapabilitySource,
  directory: string,
): GeneratedEntry {
  const lines: string[] = [];
  const locations: GeneratedEntry["locations"] extends Readonly<infer T>
    ? T
    : never = {};
  const groups = {
    codes: [] as string[],
    checks: [] as string[],
    tools: [] as string[],
    validators: [] as string[],
    continuations: [] as string[],
  };
  for (const [id, item] of Object.entries(source.modules)) {
    let file = relative(directory, item.module.sourceFile).replaceAll(
      "\\",
      "/",
    );
    if (!file.startsWith(".")) file = `./${file}`;
    const binding = `resource${lines.length}`;
    lines.push(
      `import { ${item.module.exportName} as ${binding} } from ${JSON.stringify(file)};`,
    );
    const origin = {
      location: item.module.location ?? { file: item.module.sourceFile },
      resource: { file: item.module.sourceFile },
    };
    locations[lines.length] = origin;
    const type =
      item.kind === "validator"
        ? "InteractionValidator"
        : item.kind === "continuation"
          ? "AgentContinuation"
          : item.kind === "check"
            ? "AcceptanceCheck"
            : item.kind === "tool"
              ? "AgentTool"
              : `LoomCode<${item.input === undefined ? "never" : schemaType(item.input)}, ${schemaType(item.output ?? true)}>`;
    lines.push(
      item.kind === "code" && item.input === undefined
        ? `${binding} satisfies import("@intloom/loom-sdk/compiled").CodeBinding<${schemaType(item.output ?? true)}>;`
        : `${binding} satisfies import("@intloom/loom-sdk").${type};`,
    );
    locations[lines.length] = origin;
    groups[
      item.kind === "validator"
        ? "validators"
        : item.kind === "continuation"
          ? "continuations"
          : item.kind === "check"
            ? "checks"
            : item.kind === "tool"
              ? "tools"
              : "codes"
    ].push(`${JSON.stringify(id)}: ${binding}`);
  }
  lines.push(
    `export const definition = ${JSON.stringify(source.definition)} as const satisfies import("@intloom/loom-sdk/compiled").CompiledDefinition;`,
  );
  lines.push(
    `export const plan = ${JSON.stringify(source.plan)} as const satisfies import("@intloom/loom-sdk/compiled").ExecutionPlan;`,
  );
  lines.push(
    `export const bindings = { codes: {${groups.codes.join(",")}}, checks: {${groups.checks.join(",")}}, tools: {${groups.tools.join(",")}}, validators: {${groups.validators.join(",")}}, continuations: {${groups.continuations.join(",")}} } as const satisfies import("@intloom/loom-sdk/compiled").LoomBindings;`,
  );
  return { text: `${lines.join("\n")}\n`, locations };
}
