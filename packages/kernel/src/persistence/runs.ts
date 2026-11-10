import {
  IntloomError,
  type RunEvent,
  type ArtifactRecord,
  type AcceptanceRecord,
  type RunEventsCommitted,
  type RunSummary,
} from "@intloom/loom-sdk";
import { stableJson } from "@intloom/loom-sdk/json";
import type {
  EventInput,
  RunRecord,
  RunRepository,
} from "../lifecycle/run-contracts.ts";
import { createClient, type InStatement, type Row } from "@libsql/client";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type { OutcomeListQuery } from "../outcomes/contracts.ts";

const unfinished =
  "json_extract(record, '$.view.status') IN ('created', 'running', 'waiting', 'stopping')";
const finishTime =
  "COALESCE(json_extract(record, '$.view.finishedAt'), json_extract(record, '$.view.updatedAt'))";
const summaryColumns =
  "json_remove(json_extract(record, '$.view'), '$.output') AS view";

export async function openRunRepository(
  file: string,
  onRunEvents?: (notice: RunEventsCommitted) => void,
): Promise<
  RunRepository & {
    close(): void;
    overview(): Promise<{ totalRuns: number; recent: RunSummary[] }>;
  }
> {
  const database = createClient({ url: pathToFileURL(file).href });
  try {
    await database.execute("PRAGMA journal_mode = DELETE");
    const indexed =
      (
        await database.execute(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'interaction_runs'",
        )
      ).rows.length > 0;
    await database.executeMultiple(`
    CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS acceptances (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS run_events (run_id TEXT NOT NULL, seq INTEGER NOT NULL, time TEXT NOT NULL, type TEXT NOT NULL, origin TEXT, details TEXT, schema_version INTEGER NOT NULL CHECK(schema_version = 1), execution_id TEXT, parent_execution_id TEXT, operation_id TEXT, PRIMARY KEY (run_id, seq));
    CREATE TABLE IF NOT EXISTS run_operation_details (id TEXT PRIMARY KEY, record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS run_operations (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, operation TEXT NOT NULL, time TEXT NOT NULL, reason TEXT);
    CREATE INDEX IF NOT EXISTS runs_unfinished ON runs(id) WHERE ${unfinished};
    CREATE INDEX IF NOT EXISTS runs_recent ON runs(${finishTime} DESC, id DESC) WHERE NOT (${unfinished});
    CREATE INDEX IF NOT EXISTS runs_order ON runs(json_extract(record, '$.view.createdAt') || '/' || id);
    CREATE INDEX IF NOT EXISTS artifacts_order ON artifacts(json_extract(record, '$.createdAt') || '/' || id);
    CREATE INDEX IF NOT EXISTS artifacts_run_order ON artifacts(run_id, json_extract(record, '$.createdAt') || '/' || id);
    CREATE INDEX IF NOT EXISTS acceptances_run_order ON acceptances(run_id, json_extract(record, '$.createdAt') || '/' || id);


  `);
    if (!indexed)
      await database.batch(
        [
          "CREATE TABLE interaction_runs (request_id TEXT PRIMARY KEY, run_id TEXT NOT NULL)",
          "INSERT INTO interaction_runs SELECT json_extract(item.value, '$.request.id'), runs.id FROM runs, json_each(runs.record, '$.interactions') AS item",
        ],
        "write",
      );
    const columns = new Set(
      (await database.execute("PRAGMA table_info(run_events)")).rows.map(
        (row) => String(row.name),
      ),
    );
    if (
      ![
        "schema_version",
        "execution_id",
        "parent_execution_id",
        "operation_id",
      ].every((name) => columns.has(name))
    )
      throw new IntloomError(
        "STORAGE_INCOMPATIBLE",
        "This data directory uses an older event format. Use a new data directory; existing records are unchanged.",
      );
    const unsupported = await database.execute(
      "SELECT 1 FROM run_events WHERE schema_version IS NULL OR schema_version != 1 LIMIT 1",
    );
    if (unsupported.rows.length)
      throw new IntloomError(
        "STORAGE_INCOMPATIBLE",
        "The event schema is not supported by this runtime.",
      );
  } catch (error) {
    database.close();
    if (error instanceof IntloomError) throw error;
    throw new IntloomError("STORAGE_FAILED", "Cannot open Run records.");
  }
  const events = (
    runId: string,
    values: readonly EventInput[],
    time: string,
    schema = "main",
  ): InStatement[] =>
    values.map((event) => ({
      sql: `INSERT INTO ${schema}.run_events (run_id, seq, time, type, origin, details, schema_version, execution_id, parent_execution_id, operation_id) VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM ${schema}.run_events WHERE run_id = ?), ?, ?, ?, ?, 1, ?, ?, ?) RETURNING run_id, seq`,
      args: [
        runId,
        runId,
        time,
        event.type,
        event.origin === undefined ? null : stableJson(event.origin),
        "details" in event && event.details !== undefined
          ? stableJson(event.details)
          : null,
        event.executionId ?? null,
        event.parentExecutionId ?? null,
        event.operationId ?? null,
      ],
    }));
  let tail: Promise<unknown> = Promise.resolve();
  const execute = <T>(action: () => Promise<T>): Promise<T> => {
    const result = tail.then(action).catch(() => {
      throw new IntloomError(
        "STORAGE_FAILED",
        "Run records could not be read or saved.",
      );
    });
    tail = result.catch(() => undefined);
    return result;
  };
  const listOutcomes = (
    table: "artifacts" | "acceptances",
    options: OutcomeListQuery,
  ) =>
    execute(async () => {
      const conditions: string[] = [];
      const args: (string | number)[] = [];
      if (options.runId !== undefined) {
        conditions.push("run_id = ?");
        args.push(options.runId);
      }
      const key = "json_extract(record, '$.createdAt') || '/' || id";
      if (options.after !== undefined) {
        conditions.push(`(${key}) > ?`);
        args.push(options.after);
      }
      args.push(options.limit);
      return (
        await database.execute({
          sql: `SELECT record FROM ${table} ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${key} LIMIT ?`,
          args,
        })
      ).rows;
    });
  const listeners = new Set<(notice: RunEventsCommitted) => void>();
  if (onRunEvents) listeners.add(onRunEvents);
  const commit = async (statements: InStatement[]) => {
    const results = await database.batch(statements, "write");
    const heads = new Map<string, number>();
    for (const result of results)
      for (const row of result.rows)
        if (row.run_id !== undefined && row.seq !== undefined)
          heads.set(String(row.run_id), Number(row.seq));
    for (const [runId, throughSeq] of heads)
      for (const listener of listeners) {
        try {
          listener({ runId, throughSeq });
        } catch {
          process.emitWarning("A Run event observer failed.");
        }
      }
  };
  const decodeEvent = (row: Row): RunEvent =>
    ({
      runId: String(row.run_id),
      seq: Number(row.seq),
      time: String(row.time),
      type: String(row.type),
      ...(row.origin === null
        ? {}
        : { origin: JSON.parse(String(row.origin)) }),
      ...(row.details === null
        ? {}
        : { details: JSON.parse(String(row.details)) }),
      schemaVersion: 1,
      ...(row.execution_id === null
        ? {}
        : { executionId: String(row.execution_id) }),
      ...(row.parent_execution_id === null
        ? {}
        : { parentExecutionId: String(row.parent_execution_id) }),
      ...(row.operation_id === null
        ? {}
        : { operationId: String(row.operation_id) }),
    }) as RunEvent;
  return {
    saveArtifact: (record) =>
      execute(async () => {
        await commit([
          {
            sql: "INSERT INTO artifacts (id, run_id, record) VALUES (?, ?, ?)",
            args: [record.id, record.runId, stableJson(record)],
          },
          ...events(
            record.runId,
            [
              {
                type: "artifact.created",
                executionId: record.executionId,
                ...(record.parentExecutionId
                  ? { parentExecutionId: record.parentExecutionId }
                  : {}),
                origin: record.origin,
                details: { artifactId: record.id },
              },
            ],
            record.createdAt,
          ),
        ]);
      }),
    getArtifact: (id) =>
      execute(async () => {
        const result = await database.execute({
          sql: "SELECT record FROM artifacts WHERE id = ?",
          args: [id],
        });
        return result.rows[0]
          ? (JSON.parse(String(result.rows[0].record)) as ArtifactRecord)
          : undefined;
      }),
    listArtifacts: async (options) =>
      (await listOutcomes("artifacts", options)).map(
        (row) => JSON.parse(String(row.record)) as ArtifactRecord,
      ),
    saveAcceptance: (record) =>
      execute(async () => {
        await commit([
          {
            sql: "INSERT INTO acceptances (id, run_id, record) VALUES (?, ?, ?)",
            args: [record.id, record.runId, stableJson(record)],
          },
          ...events(
            record.runId,
            [
              {
                type: "acceptance.recorded",
                executionId: record.executionId,
                ...(record.parentExecutionId
                  ? { parentExecutionId: record.parentExecutionId }
                  : {}),
                origin: record.origin,
                details: { acceptanceId: record.id, status: record.status },
              },
            ],
            record.createdAt,
          ),
        ]);
      }),
    getAcceptance: (id) =>
      execute(async () => {
        const result = await database.execute({
          sql: "SELECT record FROM acceptances WHERE id = ?",
          args: [id],
        });
        return result.rows[0]
          ? (JSON.parse(String(result.rows[0].record)) as AcceptanceRecord)
          : undefined;
      }),
    listAcceptances: async (options) =>
      (await listOutcomes("acceptances", options)).map(
        (row) => JSON.parse(String(row.record)) as AcceptanceRecord,
      ),
    get: (id) =>
      execute(async () => {
        const result = await database.execute({
          sql: "SELECT record FROM runs WHERE id = ?",
          args: [id],
        });
        return result.rows[0]
          ? (JSON.parse(String(result.rows[0].record)) as RunRecord)
          : undefined;
      }),
    listUnfinished: () =>
      execute(async () =>
        (
          await database.execute(`SELECT record FROM runs WHERE ${unfinished}`)
        ).rows.map((row) => JSON.parse(String(row.record)) as RunRecord),
      ),
    findInteraction: (requestId) =>
      execute(async () => {
        const result = await database.execute({
          sql: "SELECT runs.record FROM interaction_runs JOIN runs ON runs.id = interaction_runs.run_id WHERE request_id = ?",
          args: [requestId],
        });
        return result.rows[0]
          ? (JSON.parse(String(result.rows[0].record)) as RunRecord)
          : undefined;
      }),
    overview: () =>
      execute(async () => {
        const [count, history] = await database.batch(
          [
            "SELECT COUNT(*) AS total FROM runs",
            `SELECT ${summaryColumns} FROM runs WHERE NOT (${unfinished}) ORDER BY ${finishTime} DESC, id DESC LIMIT 10`,
          ],
          "read",
        );
        const total = count?.rows[0]?.total;
        if (total === undefined || !history)
          throw new Error("Incomplete Run overview query result.");
        return {
          totalRuns: Number(total),
          recent: history.rows.map(
            (row) => JSON.parse(String(row.view)) as RunSummary,
          ),
        };
      }),
    listViews: (options) =>
      execute(async () => {
        const conditions: string[] = [];
        const args: (string | number)[] = [];
        if (options.unfinished) conditions.push(unfinished);
        for (const [field, value] of [
          ["status", options.status],
          [
            "loom.id",
            options.loom && "id" in options.loom ? options.loom.id : undefined,
          ],
          [
            "loom.version",
            options.loom && "version" in options.loom
              ? options.loom.version
              : undefined,
          ],
          [
            "loom.artifactDigest",
            options.loom && "artifactDigest" in options.loom
              ? options.loom.artifactDigest
              : undefined,
          ],
          ["parentRunId", options.parentRunId],
        ] as const) {
          if (value === undefined) continue;
          conditions.push(`json_extract(record, '$.view.${field}') = ?`);
          args.push(value);
        }
        const key = "json_extract(record, '$.view.createdAt') || '/' || id";
        if (options.after !== undefined) {
          conditions.push(`(${key}) > ?`);
          args.push(options.after);
        }
        args.push(options.limit);
        const result = await database.execute({
          sql: `SELECT ${summaryColumns} FROM runs ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${key} LIMIT ?`,
          args,
        });
        return result.rows.map(
          (row) => JSON.parse(String(row.view)) as RunSummary,
        );
      }),
    save: async (record, values, operation, related = []) => {
      await execute(async () => {
        const roots = [
          ...new Set(related.map((item) => item.binding.location.dataDir)),
        ].filter((root) => root !== dirname(file));
        const schemas = new Map(
          roots.map((root, index) => [root, `related_${index}`]),
        );
        for (const [root, schema] of schemas)
          await database.execute({
            sql: `ATTACH DATABASE ? AS ${schema}`,
            args: [join(root, "kernel.db")],
          });
        const schemaFor = (item: RunRecord) =>
          schemas.get(item.binding.location.dataDir) ?? "main";
        try {
          const statements: InStatement[] = [
            {
              sql: "INSERT INTO runs (id, record) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET record = excluded.record",
              args: [record.view.id, stableJson(record)],
            },
            ...related.map(
              (item): InStatement => ({
                sql: `INSERT INTO ${schemaFor(item)}.runs (id, record) VALUES (?, ?)`,
                args: [item.view.id, stableJson(item)],
              }),
            ),
            ...[record, ...related].flatMap((item) =>
              (item.interactions ?? []).map(
                ({ request }): InStatement => ({
                  sql: `INSERT OR IGNORE INTO ${schemaFor(item)}.interaction_runs (request_id, run_id) VALUES (?, ?)`,
                  args: [request.id, item.view.id],
                }),
              ),
            ),
            ...events(
              record.view.id,
              values.map((event) => ({
                ...event,
                ...(operation ? { operationId: operation.id } : {}),
              })),
              record.view.updatedAt,
            ),
            ...related.flatMap((item) =>
              events(
                item.view.id,
                [{ type: "run.created" }],
                item.view.createdAt,
                schemaFor(item),
              ),
            ),
          ];
          if (operation) {
            statements.push({
              sql: "INSERT INTO run_operations (id, run_id, operation, time, reason) VALUES (?, ?, ?, ?, ?)",
              args: [
                operation.id,
                operation.runId,
                operation.operation,
                operation.time,
                operation.reason ?? null,
              ],
            });
            statements.push({
              sql: "INSERT INTO run_operation_details (id, record) VALUES (?, ?)",
              args: [operation.id, stableJson(operation)],
            });
          }
          await commit(statements);
        } finally {
          for (const schema of schemas.values())
            await database.execute(`DETACH DATABASE ${schema}`);
        }
      });
    },
    log: async (id, event) => {
      const time = new Date().toISOString();
      await execute(() => commit(events(id, [event], time)));
    },
    events: (id, after = 0, limit = -1) =>
      execute(async () =>
        (
          await database.execute({
            sql: "SELECT * FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq LIMIT ?",
            args: [id, after, limit],
          })
        ).rows.map(decodeEvent),
      ),
    snapshot: (id) =>
      execute(async () => {
        const [runs, events, artifacts] = await database.batch(
          [
            { sql: "SELECT record FROM runs WHERE id = ?", args: [id] },
            {
              sql: "SELECT * FROM run_events WHERE run_id = ? ORDER BY seq",
              args: [id],
            },
            {
              sql: "SELECT record FROM artifacts WHERE run_id = ? ORDER BY id",
              args: [id],
            },
          ],
          "read",
        );
        if (!runs?.rows[0]) return undefined;
        return {
          record: JSON.parse(String(runs.rows[0].record)) as RunRecord,
          events: (events?.rows ?? []).map(decodeEvent),
          artifacts: (artifacts?.rows ?? []).map(
            (row) => JSON.parse(String(row.record)) as ArtifactRecord,
          ),
        };
      }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      listeners.clear();
      database.close();
    },
  };
}
