import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";

/** Read migration history under the same write lock as DDL, including concurrent first opens. */
export function migrateStorage(db: BetterSQLite3Database): void {
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(
      new URL("../../../migrations/storage-sqlite/", import.meta.url),
    ),
  });
  db.transaction(
    (tx) => {
      tx.run(
        sql`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      );
      const applied = tx.all<{ hash: string; created_at: number }>(
        sql`SELECT hash, created_at FROM __drizzle_migrations ORDER BY id`,
      );
      if (
        applied.length > migrations.length ||
        applied.some(
          (entry, index) =>
            entry.hash !== migrations[index]?.hash ||
            entry.created_at !== migrations[index]?.folderMillis,
        )
      ) {
        KERNEL_ERRORS.throw("STORAGE_ERROR", {
          message:
            "Storage migration history is newer than or incompatible with this package.",
        });
      }
      for (const migration of migrations.slice(applied.length)) {
        for (const statement of migration.sql) tx.run(sql.raw(statement));
        tx.run(
          sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
        );
      }
    },
    { behavior: "immediate" },
  );
}
