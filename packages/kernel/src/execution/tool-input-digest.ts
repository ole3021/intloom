import { createHash } from "node:crypto";
import { types } from "node:util";

/** Hash bounded JSON data only; diagnostic collection must never invoke user code. */
export function toolInputDigest(input: unknown): string | undefined {
  let remaining = 1024 * 1024;
  let nodes = 16384;
  const seen = new Set<object>();
  function canonical(value: unknown, depth: number): string {
    if (--nodes < 0 || depth > 32 || remaining < 0) throw new Error();
    if (
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "string"
    ) {
      if (typeof value === "string" && value.length > remaining)
        throw new Error();
      const encoded = JSON.stringify(value);
      remaining -= encoded.length;
      if (remaining < 0) throw new Error();
      return encoded;
    }
    if (!value || typeof value !== "object" || seen.has(value))
      throw new Error();
    if (types.isProxy(value)) throw new Error();
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null)
      throw new Error();
    seen.add(value);
    try {
      const keys = array
        ? Array.from({ length: Math.min(value.length, nodes + 1) }, (_, i) =>
            String(i),
          )
        : Object.keys(value).sort();
      if (keys.length > nodes) throw new Error();
      const entries = keys.map((key) => {
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (!property || !("value" in property)) throw new Error();
        return (
          (array ? "" : `${canonical(key, depth + 1)}:`) +
          canonical(property.value, depth + 1)
        );
      });
      return array ? `[${entries.join(",")}]` : `{${entries.join(",")}}`;
    } finally {
      seen.delete(value);
    }
  }
  try {
    return createHash("sha256").update(canonical(input, 0)).digest("hex");
  } catch {
    return undefined;
  }
}
