import { PackageError } from "@intloom/loom-sdk/package-format";
/** Types describe structure; numeric bounds and other validation remain in the static contract. */
export function schemaType(
  schema: unknown,
  io: "input" | "output" = "output",
): string {
  if (schema === false) return "never";
  if (schema === true) return "JsonValue";
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    throw new PackageError(
      "SCHEMA_UNSUPPORTED",
      "Expected a finite JSON Schema.",
    );
  const s = schema as Record<string, unknown>;
  if (
    Object.keys(s).every((key) =>
      ["$schema", "description", "title"].includes(key),
    )
  )
    return "JsonValue";
  const childType = (value: unknown) => schemaType(value, io);
  if (io === "input" && Object.hasOwn(s, "default")) {
    const inner = { ...s };
    delete inner.default;
    return `(${childType(inner)} | undefined)`;
  }
  if (s.$ref || s.$dynamicRef || s.$defs)
    throw new PackageError(
      "SCHEMA_UNSUPPORTED",
      "Reference/recursive type generation is not supported.",
    );
  if (Object.hasOwn(s, "const")) return JSON.stringify(s.const);
  if (Array.isArray(s.enum))
    return s.enum.map((value) => JSON.stringify(value)).join(" | ") || "never";
  const alternatives = s.anyOf ?? s.oneOf;
  if (Array.isArray(alternatives))
    return `(${alternatives.map(childType).join(" | ")})`;
  if (Array.isArray(s.type))
    return `(${s.type.map((type) => childType({ ...s, type })).join(" | ")})`;
  switch (s.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array": {
      if (Array.isArray(s.prefixItems)) {
        const parts = s.prefixItems.map(childType);
        const minimum = typeof s.minItems === "number" ? s.minItems : 0;
        const tuple = parts.map((part, index) =>
          index < minimum ? part : `(${part})?`,
        );
        if (s.items !== false)
          tuple.push(
            `...(${s.items === undefined ? "JsonValue" : childType(s.items)})[]`,
          );
        return `[${tuple.join(", ")}]`;
      }
      return `(${s.items === undefined ? "JsonValue" : childType(s.items)})[]`;
    }
    case "object": {
      const properties = (s.properties ?? {}) as Record<string, unknown>;
      const required = new Set(
        Array.isArray(s.required) ? (s.required as string[]) : [],
      );
      const fields = Object.entries(properties).map(
        ([key, value]) =>
          `${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${childType(value)}${required.has(key) ? "" : " | undefined"}`,
      );
      const fixed = `{ ${fields.join("; ")} }`;
      if (
        s.additionalProperties === false ||
        s.additionalProperties === undefined
      )
        return fixed;
      const extra =
        s.additionalProperties === true
          ? "JsonValue"
          : childType(s.additionalProperties);
      const key =
        s.propertyNames &&
        typeof s.propertyNames === "object" &&
        "enum" in s.propertyNames
          ? childType(s.propertyNames)
          : "string";
      const map = `Record<${key}, ${extra}>`;
      return fields.length ? `(${fixed} & ${map})` : map;
    }
    default:
      throw new PackageError(
        "SCHEMA_UNSUPPORTED",
        "Schema has no supported structural type.",
      );
  }
}
