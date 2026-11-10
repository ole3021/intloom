import { IntloomError, type Page, type PageOptions } from "@intloom/loom-sdk";
import { stableJson } from "@intloom/loom-sdk/json";

export function page<T>(
  values: readonly T[],
  key: (value: T) => string,
  filter: unknown,
  options: PageOptions,
): Page<T> {
  const after = pageAfter(options.cursor, filter);
  const ordered = [...values].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
  return pageResult(
    after === undefined
      ? ordered
      : ordered.filter((value) => key(value) > after),
    key,
    filter,
    options,
  );
}

export function pageAfter(cursorValue: string | undefined, filter: unknown) {
  const binding = stableJson(filter);
  if (cursorValue) {
    try {
      const cursor = JSON.parse(
        Buffer.from(cursorValue, "base64url").toString("utf8"),
      ) as { filter: string; after: string };
      if (cursor.filter !== binding || typeof cursor.after !== "string")
        throw new Error();
      return cursor.after;
    } catch {
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Cursor does not match this query.",
      );
    }
  }
}

/** Values are ordered, after the cursor, and include one lookahead item. */
export function pageResult<T>(
  values: readonly T[],
  key: (value: T) => string,
  filter: unknown,
  options: PageOptions,
): Page<T> {
  const limit = options.limit ?? 20;
  const items = values.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(values.length > limit && last
      ? {
          nextCursor: Buffer.from(
            JSON.stringify({ filter: stableJson(filter), after: key(last) }),
          ).toString("base64url"),
        }
      : {}),
  };
}
