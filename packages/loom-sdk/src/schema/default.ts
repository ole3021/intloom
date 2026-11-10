import { type output, type ZodDefault, type ZodType, z } from "zod";
import type { JsonValue } from "../contracts/json.ts";
import { DefinitionError } from "../definitions/errors.ts";
import { copyJson, freezeJson } from "./json.ts";
import { assertPortableSchema, defaultMarker } from "./portable.ts";

export function withDefault<S extends ZodType>(
  schema: S,
  value: NoInfer<output<S>> & JsonValue,
): ZodDefault<S> {
  assertPortableSchema(schema, "input", "withDefault.schema", true);
  const constant = copyJson(value, "withDefault.value");
  const accepted = schema.safeParse(constant);
  if (!accepted.success)
    throw new DefinitionError(
      "DEFAULT_INVALID",
      "withDefault.value",
      accepted.error.message,
    );
  // A default is already normalized output, not input that needs stripping or nested defaults.
  const same = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object")
      return false;
    const left = Object.keys(a);
    const right = Object.keys(b);
    return (
      left.length === right.length &&
      left.every(
        (key) =>
          Object.hasOwn(b, key) &&
          same(Reflect.get(a, key), Reflect.get(b, key)),
      )
    );
  };
  if (!same(accepted.data, constant))
    throw new DefinitionError(
      "DEFAULT_INVALID",
      "withDefault.value",
      "Default must already satisfy the normalized output shape.",
    );
  freezeJson(constant);
  const definition = {
    type: "default" as const,
    innerType: schema,
    get defaultValue() {
      return structuredClone(constant) as Exclude<output<S>, undefined>;
    },
  };
  Object.defineProperty(definition, defaultMarker, {
    value: constant,
    enumerable: true,
  });
  return new z.ZodDefault(definition) as ZodDefault<S>;
}
