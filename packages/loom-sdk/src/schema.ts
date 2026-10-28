import * as z from "zod";
import type { JsonValue } from "./json.ts";

export type JsonSchema = boolean | { readonly [key: string]: JsonValue };
export const jsonSchemaSchema = z.union([
  z.boolean(),
  z.record(z.string(), z.json()),
]);

const keywords = new Set([
  "$schema",
  "$ref",
  "$defs",
  "oneOf",
  "anyOf",
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "enum",
  "const",
  "title",
  "description",
  "examples",
]);

function literalSchema(value: JsonValue): JsonSchema {
  if (Array.isArray(value))
    return {
      type: "array",
      prefixItems: value.map(literalSchema),
      items: false,
      minItems: value.length,
      maxItems: value.length,
    };
  if (value !== null && typeof value === "object")
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          literalSchema(child),
        ]),
      ),
      required: Object.keys(value),
      additionalProperties: false,
    };
  return { const: value };
}

/** The converter treats enum/const as alternatives to sibling constraints; JSON Schema requires both. */
function converterSchema(value: JsonSchema): JsonSchema {
  if (typeof value === "boolean") return value;
  const { enum: choices, const: constant, ...rest } = value;
  const base: Record<string, JsonValue> = rest;
  for (const keyword of ["properties", "$defs"] as const) {
    const children = base[keyword];
    if (children && typeof children === "object" && !Array.isArray(children))
      base[keyword] = Object.fromEntries(
        Object.entries(children).map(([key, child]) => [
          key,
          converterSchema(child as JsonSchema),
        ]),
      );
  }
  for (const keyword of ["items", "additionalProperties"] as const)
    if (base[keyword] !== undefined)
      base[keyword] = converterSchema(base[keyword] as JsonSchema);
  // The converter applies array bounds only when an item schema is present.
  if (base.type === "array" && base.items === undefined) base.items = true;
  for (const key of ["oneOf", "anyOf"] as const)
    if (Array.isArray(base[key]))
      base[key] = base[key].map((child) =>
        converterSchema(child as JsonSchema),
      );
  const constraints: JsonSchema[] = [];
  if (Array.isArray(choices))
    constraints.push({ anyOf: choices.map(literalSchema) });
  if (constant !== undefined) constraints.push(literalSchema(constant));
  return constraints.length ? { ...base, allOf: constraints } : base;
}

/** A deliberately bounded JSON Schema dialect. Unsupported constraints are errors, never discarded. */
export function schemaFromJson(input: JsonSchema): z.ZodType<JsonValue> {
  const schema = jsonSchemaSchema.parse(input);
  function check(value: JsonSchema): void {
    if (typeof value === "boolean") return;
    for (const key of Object.keys(value)) {
      if (!keywords.has(key))
        throw new Error(`Unsupported JSON Schema keyword: ${key}`);
    }
    if (
      value.$schema !== undefined &&
      value.$schema !== "https://json-schema.org/draft/2020-12/schema"
    )
      throw new Error("Only JSON Schema draft 2020-12 is supported");
    for (const key of ["properties", "$defs"] as const) {
      const children = value[key];
      if (children !== undefined) {
        if (
          !children ||
          typeof children !== "object" ||
          Array.isArray(children)
        )
          throw new Error(`Invalid ${key}`);
        for (const child of Object.values(children))
          check(jsonSchemaSchema.parse(child));
      }
    }
    for (const key of ["items", "additionalProperties"] as const)
      if (value[key] !== undefined) check(jsonSchemaSchema.parse(value[key]));
    for (const key of ["oneOf", "anyOf"] as const) {
      const children = value[key];
      if (children !== undefined) {
        if (!Array.isArray(children) || !children.length)
          throw new Error(`${key} must contain schemas`);
        for (const child of children) check(jsonSchemaSchema.parse(child));
      }
    }
    if (value.$ref !== undefined)
      throw new Error("Resolve Schema references during compilation");
    if (
      value.type !== undefined &&
      ![
        "string",
        "number",
        "integer",
        "boolean",
        "null",
        "object",
        "array",
      ].includes(String(value.type))
    )
      throw new Error("Use one supported explicit JSON Schema type");
    for (const key of ["title", "description"] as const)
      if (value[key] !== undefined && typeof value[key] !== "string")
        throw new Error(`Invalid ${key}`);
    for (const [type, keys] of [
      ["object", ["properties", "required", "additionalProperties"]],
      ["array", ["items", "minItems", "maxItems"]],
      ["string", ["minLength", "maxLength", "pattern"]],
    ] as const)
      for (const key of keys)
        if (value[key] !== undefined && value.type !== type)
          throw new Error(`${key} requires explicit type ${type}`);
    if (
      value.required !== undefined &&
      (!Array.isArray(value.required) ||
        value.required.some((key) => typeof key !== "string") ||
        new Set(value.required).size !== value.required.length)
    )
      throw new Error("required must contain unique property names");
    if (Array.isArray(value.required))
      for (const key of value.required)
        if (
          !value.properties ||
          typeof value.properties !== "object" ||
          !Object.hasOwn(value.properties, String(key))
        )
          throw new Error(`Required property must be declared: ${String(key)}`);
    for (const key of [
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
    ] as const)
      if (
        value[key] !== undefined &&
        (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0)
      )
        throw new Error(`Invalid ${key}`);
    if (value.pattern !== undefined) {
      if (typeof value.pattern !== "string") throw new Error("Invalid pattern");
      new RegExp(value.pattern);
    }
    for (const key of [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
    ] as const) {
      if (
        value[key] !== undefined &&
        (typeof value[key] !== "number" ||
          !["number", "integer"].includes(String(value.type)) ||
          (key === "multipleOf" && Number(value[key]) <= 0))
      )
        throw new Error(`Invalid ${key}`);
    }
    if (
      value.enum !== undefined &&
      (!Array.isArray(value.enum) || !value.enum.length)
    )
      throw new Error("enum must be a nonempty array");
  }
  check(schema);
  if (schema === true) return z.json();
  if (schema === false) return z.never();
  const converted = z.fromJSONSchema(converterSchema(schema));
  // Keep object rejection issues on the original schema; piping would discard them in Zod 4.6.5.
  return converted.refine(
    (value) => z.json().safeParse(value).success,
    "Expected a JSON value",
  ) as z.ZodType<JsonValue>;
}

export function parseSchemaValue(
  schema: JsonSchema,
  value: unknown,
): JsonValue {
  return schemaFromJson(schema).parse(value);
}
