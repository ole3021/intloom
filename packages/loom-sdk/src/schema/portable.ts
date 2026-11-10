import type { core } from "zod";
import { DefinitionError } from "../definitions/errors.ts";

export type SchemaRole = "input" | "output" | "suspend" | "resume";
export const defaultMarker = "intloom.constantDefault.v1";

// Inspect the pinned Zod definition format, not instanceof or a process-local registry.
// In particular, never read an unmarked defaultValue getter.
export function assertPortableSchema(
  schema: core.$ZodType,
  role: SchemaRole,
  path: string = role,
  optionalProperty = false,
): void {
  const ancestors = new Set<core.$ZodType>();
  function visit(
    node: core.$ZodType,
    location: string,
    optionalProperty: boolean,
  ): void {
    const fail = (message: string): never => {
      throw new DefinitionError("SCHEMA_UNSUPPORTED", location, message);
    };
    if (!node?._zod?.def) fail("Expected a Zod 4 schema.");
    if (ancestors.has(node))
      fail("Recursive schemas are not supported in 0.3.0.");
    ancestors.add(node);
    const def = node._zod.def as core.$ZodTypes["_zod"]["def"];
    if (typeof def.error === "function")
      fail("Custom error callbacks are not portable schema declarations.");
    if ("coerce" in def && def.coerce)
      fail("Coercion is not part of a portable contract; use Code or map.");
    const checks = [...(def.checks ?? [])];
    if (node._zod.traits.has("$ZodCheck"))
      checks.push(node as unknown as core.$ZodCheck);
    for (const check of checks) {
      const rule = check._zod.def;
      if (
        ![
          "less_than",
          "greater_than",
          "multiple_of",
          "number_format",
          "min_length",
          "max_length",
          "length_equals",
          "string_format",
        ].includes(rule.check)
      ) {
        fail(
          `Unsupported check ${rule.check}; custom refinements and transformations are not portable.`,
        );
      }
      if (
        "pattern" in rule &&
        rule.pattern instanceof RegExp &&
        /[^u]/.test(rule.pattern.flags)
      ) {
        fail("Regular expression flags cannot be preserved in JSON Schema.");
      }
      if (
        ("fn" in rule &&
          !("pattern" in rule && rule.pattern instanceof RegExp)) ||
        typeof rule.error === "function"
      )
        fail("Custom format and error callbacks are not portable.");
      if (
        ("normalize" in rule && rule.normalize) ||
        "hostname" in rule ||
        "protocol" in rule
      )
        fail(
          "URL normalization and host/protocol restrictions cannot be preserved in this contract.",
        );
      if (
        Object.values(rule).some(
          (value) => typeof value === "number" && !Number.isFinite(value),
        )
      )
        fail("Schema constraints must use finite JSON numbers.");
    }
    switch (def.type) {
      case "string":
      case "number":
      case "boolean":
      case "null":
        break;
      case "literal":
        if (
          def.values.some(
            (value) =>
              value !== null &&
              !["string", "boolean", "number"].includes(typeof value),
          )
        )
          fail("Only JSON literals are supported.");
        if (
          def.values.some(
            (value) => typeof value === "number" && !Number.isFinite(value),
          )
        )
          fail("Only finite numbers are supported.");
        break;
      case "enum":
        if (
          Object.values(def.entries).some(
            (value) => typeof value === "number" && !Number.isFinite(value),
          )
        )
          fail("Only finite enum values are supported.");
        break;
      case "object":
        if (
          Object.values(Object.getOwnPropertyDescriptors(def.shape)).some(
            (property) => property.get || property.set,
          )
        )
          fail(
            "Schema property getters and recursive declarations are not supported in 0.3.0.",
          );
        for (const [key, child] of Object.entries(def.shape))
          visit(child, `${location}.${key}`, true);
        // unknown catchalls implement passthrough; actual values still cross the JSON boundary.
        if (
          def.catchall &&
          !["never", "unknown"].includes(def.catchall._zod.def.type)
        )
          visit(def.catchall, `${location}.*`, false);
        break;
      case "array":
        visit(def.element, `${location}[]`, false);
        break;
      case "tuple":
        def.items.forEach((child, index) => {
          visit(child, `${location}[${index}]`, false);
        });
        if (def.rest) visit(def.rest, `${location}[...]`, false);
        break;
      case "union":
        def.options.forEach((child, index) => {
          visit(child, `${location}|${index}`, optionalProperty);
        });
        break;
      case "record":
        visit(def.keyType, `${location}.key`, false);
        visit(def.valueType, `${location}.value`, false);
        break;
      case "optional":
        if (!optionalProperty)
          fail("undefined is allowed only as an omitted object property.");
        visit(def.innerType, location, true);
        break;
      case "nullable":
        visit(def.innerType, location, optionalProperty);
        break;
      case "default":
        if (role === "output" || role === "suspend")
          fail("Defaults are only allowed in input and resume schemas.");
        if (!Object.hasOwn(def, defaultMarker))
          fail(
            "Use withDefault(schema, value); native .default(...) has no constant declaration.",
          );
        visit(def.innerType, location, true);
        break;
      default:
        fail(`Unsupported schema type ${def.type}.`);
    }
    ancestors.delete(node);
  }
  visit(schema, path, optionalProperty);
}
