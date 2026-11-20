import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  executionIdSchema,
  createExecutionSchema,
  completeExecutionSchema,
  executionQuerySchema,
  executionAssociationSchema,
  type CompleteExecution,
  type CreateExecution,
  type ExecutionCompletion,
  type ExecutionEvent,
  type ExecutionQuery,
  type ExecutionRecord,
} from "./contracts.ts";
import { transaction } from "../persistence/database.ts";
import { jsonText } from "../persistence/json.ts";
import {
  cursorPosition,
  cursorScope,
  page,
  pageOptionsSchema,
  type Page,
  type PageOptions,
} from "../persistence/pagination.ts";

export function records(database: DatabaseSync, dataDir: string) {
  function get(executionId: string): ExecutionRecord | undefined {
    const row = database
      .prepare("SELECT record FROM executions WHERE execution_id = ?")
      .get(executionId);
    return row
      ? (JSON.parse(row.record as string) as ExecutionRecord)
      : undefined;
  }

  return {
    get(executionId: string) {
      return get(executionIdSchema.parse(executionId));
    },
    create(raw: CreateExecution): ExecutionRecord {
      const input = createExecutionSchema.parse(raw);
      const value =
        input.input === undefined
          ? {}
          : { input: JSON.parse(jsonText(input.input)) };
      return transaction(database, () => {
        const installation = database
          .prepare(
            "SELECT record FROM installations WHERE name = ? AND version = ?",
          )
          .get(input.package.name, input.package.version);
        if (!installation)
          throw new Error("Execution requires a registered installation");
        const parent =
          input.parentId === undefined ? undefined : get(input.parentId);
        if (input.parentId !== undefined && !parent)
          throw new Error("Parent execution does not exist");
        if (
          parent &&
          (parent.package.name !== input.package.name ||
            parent.package.version !== input.package.version)
        )
          throw new Error(
            "Child execution must retain its parent's package binding",
          );
        const record: ExecutionRecord = {
          executionId: randomUUID(),
          ...executionAssociationSchema.parse(
            parent
              ? parent.mode === "chat"
                ? { mode: "chat" }
                : {
                    mode: parent.mode,
                    runId: parent.runId,
                    ...(parent.mode === "patch"
                      ? { patchId: parent.patchId }
                      : {}),
                  }
              : "mode" in input
                ? {
                    mode: input.mode,
                    ...("runId" in input ? { runId: input.runId } : {}),
                    ...("patchId" in input ? { patchId: input.patchId } : {}),
                  }
                : {},
          ),
          package: input.package,
          kind: input.kind,
          createdAt: new Date().toISOString(),
          ...(parent === undefined ? {} : { parentId: parent.executionId }),
          ...value,
        };
        database
          .prepare(
            `INSERT INTO executions
             (execution_id, mode, run_id, parent_id, loom_id, version, status, record)
             VALUES (?, ?, ?, ?, ?, ?, 'recorded', ?)`,
          )
          .run(
            record.executionId,
            record.mode,
            record.mode === "chat" ? null : record.runId,
            record.parentId ?? null,
            record.package.name,
            record.package.version,
            JSON.stringify(record),
          );
        database
          .prepare("INSERT INTO events (execution_id, record) VALUES (?, ?)")
          .run(
            record.executionId,
            JSON.stringify({
              type: "recorded",
              executionId: record.executionId,
              at: record.createdAt,
              data: record,
            }),
          );
        return record;
      });
    },
    complete(executionId: string, raw: CompleteExecution): ExecutionRecord {
      executionIdSchema.parse(executionId);
      const input = completeExecutionSchema.parse(raw);
      const completion: ExecutionCompletion = {
        result: input.result,
        completedAt: new Date().toISOString(),
        ...(input.value === undefined
          ? {}
          : { value: JSON.parse(jsonText(input.value)) }),
      };
      return transaction(database, () => {
        const existing = get(executionId);
        if (!existing) throw new Error("Execution does not exist");
        if (existing.completion)
          throw new Error("Execution is already completed");
        const record: ExecutionRecord = { ...existing, completion };
        database
          .prepare(
            "UPDATE executions SET status = ?, record = ? WHERE execution_id = ?",
          )
          .run(completion.result.status, JSON.stringify(record), executionId);
        database
          .prepare("INSERT INTO events (execution_id, record) VALUES (?, ?)")
          .run(
            executionId,
            JSON.stringify({
              type: "completed",
              executionId,
              at: completion.completedAt,
              data: completion,
            }),
          );
        return record;
      });
    },
    list(raw: ExecutionQuery = {}): Page<ExecutionRecord> {
      const { limit, cursor, loomId, status, runId, mode } =
        executionQuerySchema.parse(raw);
      const scope = cursorScope([
        dataDir,
        "executions",
        loomId,
        status,
        runId,
        ...(mode ? [mode] : []),
      ]);
      const position = cursorPosition(cursor, scope) ?? 0;
      if (typeof position !== "number")
        throw new Error("Invalid execution cursor position");
      const rows = database
        .prepare(
          `SELECT position, record FROM executions WHERE position > ?
           AND (? IS NULL OR loom_id = ?) AND (? IS NULL OR status = ?)
           AND (? IS NULL OR run_id = ?) AND (? IS NULL OR mode = ?)
           ORDER BY position LIMIT ?`,
        )
        .all(
          position,
          loomId ?? null,
          loomId ?? null,
          status ?? null,
          status ?? null,
          runId ?? null,
          runId ?? null,
          mode ?? null,
          mode ?? null,
          limit + 1,
        );
      const result = page(rows, limit, scope, (row) => row.position as number);
      return {
        ...result,
        entries: result.entries.map(
          (row) => JSON.parse(row.record as string) as ExecutionRecord,
        ),
      };
    },
    events(executionId: string, raw: PageOptions = {}): Page<ExecutionEvent> {
      executionIdSchema.parse(executionId);
      const { limit, cursor } = pageOptionsSchema.parse(raw);
      const scope = cursorScope([dataDir, "events", executionId]);
      const position = cursorPosition(cursor, scope) ?? 0;
      if (typeof position !== "number")
        throw new Error("Invalid event cursor position");
      const rows = database
        .prepare(
          `SELECT sequence, record FROM events
           WHERE execution_id = ? AND sequence > ? ORDER BY sequence LIMIT ?`,
        )
        .all(executionId, position, limit + 1)
        .map(
          (row) =>
            ({
              ...(JSON.parse(row.record as string) as Omit<
                ExecutionEvent,
                "sequence"
              >),
              sequence: row.sequence as number,
            }) as ExecutionEvent,
        );
      return page(rows, limit, scope, (row) => row.sequence);
    },
  };
}
