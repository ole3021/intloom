import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function transaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const value = operation();
    database.exec("COMMIT");
    return value;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function openDatabase(
  path: string,
  schema: string,
  targetVersion = 1,
  migrate?: (database: DatabaseSync, version: number) => void,
): Promise<DatabaseSync> {
  await mkdir(dirname(path), { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA busy_timeout = 1000; PRAGMA foreign_keys = ON");
    transaction(database, () => {
      const version = database
        .prepare("PRAGMA user_version")
        .get()?.user_version;
      if (typeof version !== "number" || version < 0 || version > targetVersion)
        throw new Error(`Unsupported database schema version: ${version}`);
      if (version === 0) {
        database.exec(schema);
      } else if (version < targetVersion) {
        if (!migrate)
          throw new Error(`Unsupported database schema version: ${version}`);
        migrate(database, version);
      }
      database.exec(`PRAGMA user_version = ${targetVersion}`);
    });
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
