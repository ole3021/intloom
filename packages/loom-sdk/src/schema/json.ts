import type { JsonValue } from "../contracts/json.ts";
import { DefinitionError } from "../definitions/errors.ts";

// This boundary copies constants without invoking getters or accepting non-JSON values.
export function copyJson(
  value: unknown,
  path: string,
  ancestors = new Set<object>(),
): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    throw new DefinitionError(
      "DEFAULT_INVALID",
      path,
      "Expected finite, acyclic JSON data.",
    );
  }
  const array = Array.isArray(value);
  if (
    !array &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new DefinitionError(
      "DEFAULT_INVALID",
      path,
      "Expected a plain JSON object.",
    );
  }
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === "symbol" || descriptor?.get || descriptor?.set) {
      throw new DefinitionError(
        "DEFAULT_INVALID",
        path,
        "JSON constants cannot contain symbols or accessors.",
      );
    }
  }
  let result: JsonValue;
  if (array) {
    result = Array.from({ length: value.length }, (_, index) =>
      copyJson(
        descriptors[String(index)]?.value,
        `${path}/${index}`,
        ancestors,
      ),
    );
    if (Object.keys(value).length !== value.length) {
      throw new DefinitionError(
        "DEFAULT_INVALID",
        path,
        "JSON arrays cannot contain additional properties or holes.",
      );
    }
  } else {
    result = Object.fromEntries(
      Object.entries(descriptors).map(([key, descriptor]) => [
        key,
        copyJson(descriptor.value, `${path}/${key}`, ancestors),
      ]),
    );
  }
  ancestors.delete(value);
  return result;
}

export function freezeJson(value: JsonValue): void {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  );
}
