import { createHash } from "node:crypto";
import type { JsonValue } from "@intloom/loom-sdk";
import * as z from "zod";
export const json = (value: unknown): JsonValue =>
  z.json().parse(JSON.parse(JSON.stringify(value)));
export function digest(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, item]) => [k, canonical(item)]),
      );
    return v;
  }
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
