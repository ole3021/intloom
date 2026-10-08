import { mkdir } from "node:fs/promises";
import { logStorageAccess } from "../log-access.ts";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as z from "zod";
import type { StorageAccess, StorageHandle } from "../contracts.ts";
import { storageError } from "../errors.ts";
import { createLifecycle } from "../lifecycle.ts";
import { prepareQuery, toPage } from "../query.ts";
import { nameSchema, parseInput, parseOperations } from "../schemas.ts";
import type { StorageQuery } from "../types.ts";
import { migrateStorage } from "./migrate.ts";
import { artifacts, projects, records } from "./schema.ts";
import {
  artifactKey,
  recordKey,
  readArtifact,
  readRecord,
  queryConditions,
} from "./query.ts";
import { commitOperations } from "./commit.ts";

export interface SqliteStorageOptions {
  readonly filename: string;
  readonly projectId: string;
}

export async function openSqliteStorage(
  options: SqliteStorageOptions,
): Promise<StorageHandle> {
  const parsed = parseInput(
    z.strictObject({ filename: z.string().min(1), projectId: nameSchema }),
    options,
  );
  const filename = resolve(parsed.filename);
  const projectId = parsed.projectId;
  let client: Database.Database | undefined;
  try {
    await mkdir(dirname(filename), { recursive: true });
    client = new Database(filename, { timeout: 1000 });
    client.pragma("journal_mode = WAL");
    client.pragma("synchronous = FULL");
    client.pragma("foreign_keys = ON");
    const db = drizzle(client);
    migrateStorage(db);
    db.insert(projects).values({ projectId }).onConflictDoNothing().run();
    const connection = client;
    const lifecycle = createLifecycle(() => {
      connection.close();
    });
    const scope = JSON.stringify([filename, projectId]);
    const listArtifacts = (input: StorageQuery) =>
      lifecycle.run(() => {
        const query = prepareQuery(input, scope, "artifacts");
        const order = query.order === "created_asc" ? asc : desc;
        const rows = db
          .select()
          .from(artifacts)
          .where(queryConditions(artifacts, projectId, query))
          .orderBy(order(artifacts.createdAt), order(artifacts.id))
          .limit(query.limit + 1)
          .all();
        return toPage(rows.map(readArtifact), query);
      });
    const listRecords = (input: StorageQuery) =>
      lifecycle.run(() => {
        const query = prepareQuery(input, scope, "records");
        const order = query.order === "created_asc" ? asc : desc;
        const rows = db
          .select()
          .from(records)
          .where(queryConditions(records, projectId, query))
          .orderBy(order(records.createdAt), order(records.id))
          .limit(query.limit + 1)
          .all();
        return toPage(rows.map(readRecord), query);
      });
    const access: StorageAccess = Object.freeze<StorageAccess>({
      getArtifact: (flowName, stageName) =>
        lifecycle.run(() => {
          parseInput(nameSchema, flowName);
          parseInput(nameSchema, stageName);
          const row = db
            .select()
            .from(artifacts)
            .where(
              and(
                eq(artifacts.projectId, projectId),
                eq(artifacts.flowName, flowName),
                eq(artifacts.stageName, stageName),
              ),
            )
            .get();
          return row ? readArtifact(row) : undefined;
        }),
      getArtifactById: (id) =>
        lifecycle.run(() => {
          const row = db
            .select()
            .from(artifacts)
            .where(artifactKey(projectId, parseInput(nameSchema, id)))
            .get();
          return row ? readArtifact(row) : undefined;
        }),
      getLatestRecord: (flowName, stageName) =>
        lifecycle.run(() => {
          parseInput(nameSchema, flowName);
          parseInput(nameSchema, stageName);
          return listRecords({ flowName, stageName, limit: 1 }).then(
            (page) => page.data[0],
          );
        }),
      getRecordById: (id) =>
        lifecycle.run(() => {
          const row = db
            .select()
            .from(records)
            .where(recordKey(projectId, parseInput(nameSchema, id)))
            .get();
          return row ? readRecord(row) : undefined;
        }),
      listArtifacts,
      listRecords,
      commit: (input) =>
        lifecycle.run(() => {
          const operations = parseOperations(input);
          return commitOperations(db, projectId, operations);
        }),
    });
    return Object.freeze({
      access: logStorageAccess(access),
      dispose: lifecycle.dispose,
    });
  } catch (cause) {
    try {
      client?.close();
    } catch (cleanup) {
      throw storageError(
        new AggregateError(
          [cause, cleanup],
          "Storage initialization and cleanup failed.",
        ),
      );
    }
    throw storageError(cause);
  }
}
