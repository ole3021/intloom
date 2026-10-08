import { createHash } from "node:crypto";
import * as z from "zod";
import { invalid } from "./errors.ts";
import {
  nameSchema,
  parseInput,
  querySchema,
  timestampSchema,
} from "./schemas.ts";
import type { ListPage, StorageQuery, StorageCategory } from "./types.ts";

interface Position {
  readonly createdAt: string;
  readonly id: string;
}
const cursorSchema = z.strictObject({
  version: z.literal(1),
  fingerprint: z.string(),
  createdAt: timestampSchema,
  id: nameSchema,
});
export function compareText(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}
export function comparePosition(a: Position, b: Position): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}
export function prepareQuery(
  input: StorageQuery,
  scope: string,
  category: StorageCategory,
) {
  const query = parseInput(querySchema, input);
  const ids =
    query.ids === undefined
      ? undefined
      : [...new Set(query.ids)].sort(compareText);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        scope,
        category,
        query.flowName ?? null,
        query.stageName ?? null,
        ids ?? null,
        query.createdAfter ?? null,
        query.createdBefore ?? null,
        query.order,
      ]),
    )
    .digest("hex");
  let after: Position | undefined;
  if (query.cursor) {
    try {
      const buffer = Buffer.from(query.cursor, "base64url");
      if (buffer.toString("base64url") !== query.cursor)
        invalid("Invalid cursor encoding.");
      const cursor = cursorSchema.parse(JSON.parse(buffer.toString("utf8")));
      if (cursor.fingerprint !== fingerprint)
        invalid("Cursor does not match this query or project.");
      after = cursor;
    } catch {
      invalid("Invalid cursor or cursor does not match this query or project.");
    }
  }
  return { ...query, ids, fingerprint, after };
}
export type PreparedQuery = ReturnType<typeof prepareQuery>;

export function matches(
  entry: Position & { flowName: string; stageName: string },
  query: PreparedQuery,
): boolean {
  return (
    (query.flowName === undefined || entry.flowName === query.flowName) &&
    (query.stageName === undefined || entry.stageName === query.stageName) &&
    (query.ids === undefined || query.ids.includes(entry.id)) &&
    (query.createdAfter === undefined ||
      entry.createdAt > query.createdAfter) &&
    (query.createdBefore === undefined ||
      entry.createdAt < query.createdBefore) &&
    (query.after === undefined ||
      comparePosition(entry, query.after) *
        (query.order === "created_asc" ? 1 : -1) >
        0)
  );
}
export function toPage<T extends Position>(
  rows: readonly T[],
  query: PreparedQuery,
): ListPage<T> {
  const data = structuredClone(rows.slice(0, query.limit));
  const last = data.at(-1);
  return {
    data,
    ...(rows.length > query.limit && last
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({
              version: 1,
              fingerprint: query.fingerprint,
              createdAt: last.createdAt,
              id: last.id,
            }),
          ).toString("base64url"),
        }
      : {}),
  };
}
