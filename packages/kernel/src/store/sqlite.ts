import { join } from "node:path";
import { loomIdSchema, type JsonValue } from "@intloom/loom-sdk";
import { keySchema, listSchema, type StoreHandle } from "./contracts.ts";
import { openDatabase } from "../persistence/database.ts";
import { jsonText } from "../persistence/json.ts";
import {
  cursorPosition,
  cursorScope,
  page,
} from "../persistence/pagination.ts";
import { dataRoot, loomDirectory, type DataOptions } from "../paths.ts";

export async function openStore(
  loomId?: string,
  options: DataOptions = {},
): Promise<StoreHandle> {
  const owner = loomIdSchema.optional().parse(loomId);
  const root = await dataRoot(options);
  return openBoundStore(root, owner);
}

export async function openBoundStore(
  root: string,
  owner: string | undefined,
): Promise<StoreHandle> {
  const file = join(
    owner === undefined ? root : loomDirectory(root, owner),
    "store.sqlite",
  );
  const database = await openDatabase(
    file,
    "CREATE TABLE kv (key TEXT PRIMARY KEY COLLATE BINARY, value TEXT NOT NULL) STRICT",
  );
  return {
    async get(key) {
      const row = database
        .prepare("SELECT value FROM kv WHERE key = ?")
        .get(keySchema.parse(key));
      return row === undefined
        ? undefined
        : (JSON.parse(row.value as string) as JsonValue);
    },
    async set(key, value) {
      const validKey = keySchema.parse(key);
      const text = jsonText(value);
      database
        .prepare(
          "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .run(validKey, text);
    },
    async delete(key) {
      database
        .prepare("DELETE FROM kv WHERE key = ?")
        .run(keySchema.parse(key));
    },
    async list(options = {}) {
      const { prefix, limit, cursor } = listSchema.parse(options);
      const scope = cursorScope([file, "kv", prefix]);
      const position = cursorPosition(cursor, scope);
      if (position !== undefined && typeof position !== "string")
        throw new Error("Invalid KV cursor position");
      const rows = database
        .prepare(
          `SELECT key, value FROM kv
           WHERE (? IS NULL OR key > ?)
             AND (? = '' OR substr(CAST(key AS BLOB), 1, length(CAST(? AS BLOB))) = CAST(? AS BLOB))
           ORDER BY key COLLATE BINARY LIMIT ?`,
        )
        .all(
          position ?? null,
          position ?? null,
          prefix,
          prefix,
          prefix,
          limit + 1,
        )
        .map((row) => ({
          key: row.key as string,
          value: JSON.parse(row.value as string) as JsonValue,
        }));
      return page(rows, limit, scope, (row) => row.key);
    },
    async close() {
      if (database.isOpen) database.close();
    },
  };
}
