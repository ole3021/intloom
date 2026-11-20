import { createHash } from "node:crypto";
import { z } from "zod";

export interface PageOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface Page<T> {
  readonly entries: readonly T[];
  readonly nextCursor?: string;
}

export const pageOptionsSchema = z.strictObject({
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().min(1).optional(),
});

const cursorSchema = z.strictObject({
  version: z.literal(1),
  scope: z.string(),
  position: z.union([z.string(), z.number().int().nonnegative()]),
});

export function cursorScope(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function cursorPosition(
  cursor: string | undefined,
  scope: string,
): string | number | undefined {
  if (cursor === undefined) return;
  const parsed = cursorSchema.parse(
    JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
  );
  if (parsed.scope !== scope)
    throw new Error("Cursor does not belong to this query");
  return parsed.position;
}

export function page<T>(
  rows: readonly T[],
  limit: number,
  scope: string,
  position: (row: T) => string | number,
): Page<T> {
  const entries = rows.slice(0, limit);
  const last = entries.at(-1);
  return {
    entries,
    ...(rows.length > limit && last !== undefined
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({ version: 1, scope, position: position(last) }),
          ).toString("base64url"),
        }
      : {}),
  };
}
