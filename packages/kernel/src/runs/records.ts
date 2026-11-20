import { EventEmitter } from "node:events";
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "../persistence/database.ts";
import {
  cursorPosition,
  cursorScope,
  page,
  pageOptionsSchema,
  type PageOptions,
} from "../persistence/pagination.ts";
import {
  runIdSchema,
  runQuerySchema,
  type RunEvent,
  type RunEventInput,
  type RunInteraction,
  type RunQuery,
  type RunRecord,
  type RuntimeOwner,
} from "./contracts.ts";

export function runRecords(database: DatabaseSync, dataDir: string) {
  const changes = new EventEmitter();
  changes.setMaxListeners(0);
  function get(runId: string): RunRecord | undefined {
    const row = database
      .prepare("SELECT record FROM runs WHERE run_id = ?")
      .get(runIdSchema.parse(runId));
    return row ? (JSON.parse(row.record as string) as RunRecord) : undefined;
  }
  function requireRun(runId: string): RunRecord {
    const run = get(runId);
    if (!run) throw new Error(`Run does not exist: ${runId}`);
    return run;
  }
  function append(runId: string, event: RunEventInput, at: string) {
    database
      .prepare("INSERT INTO run_events (run_id, record) VALUES (?, ?)")
      .run(runId, JSON.stringify({ ...event, at, runId }));
  }
  function update(
    runId: string,
    change: Partial<RunRecord>,
    event: RunEventInput,
  ): RunRecord {
    const record = transaction(database, () => {
      const existing = requireRun(runId);
      if (existing.phase === "finished")
        throw new Error("Run is already finished");
      const record = {
        ...existing,
        ...change,
        updatedAt: new Date().toISOString(),
      };
      database
        .prepare("UPDATE runs SET phase = ?, record = ? WHERE run_id = ?")
        .run(record.phase, JSON.stringify(record), runId);
      append(runId, event, record.updatedAt);
      return record;
    });
    changes.emit(runId);
    return record;
  }
  return {
    get,
    require: requireRun,
    update,
    create(record: RunRecord) {
      transaction(database, () => {
        database
          .prepare(
            "INSERT INTO runs (run_id, loom_id, phase, record) VALUES (?, ?, ?, ?)",
          )
          .run(
            record.runId,
            record.package.name,
            record.phase,
            JSON.stringify(record),
          );
        append(
          record.runId,
          { type: "created", data: record },
          record.createdAt,
        );
      });
      changes.emit(record.runId);
      return record;
    },
    interaction(runId: string, interaction: RunInteraction) {
      const run = requireRun(runId);
      const others = run.interactions.filter(
        (item) => item.id !== interaction.id,
      );
      return update(
        runId,
        { interactions: [...others, interaction] },
        { type: "interaction", data: interaction },
      );
    },
    list(raw: RunQuery = {}) {
      const { cursor, limit, loomId, phase } = runQuerySchema.parse(raw);
      const scope = cursorScope([dataDir, "runs", loomId, phase]);
      const position = cursorPosition(cursor, scope) ?? 0;
      if (typeof position !== "number")
        throw new Error("Invalid Run cursor position");
      const rows = database
        .prepare(`SELECT position, record FROM runs WHERE position > ?
        AND (? IS NULL OR loom_id = ?) AND (? IS NULL OR phase = ?) ORDER BY position LIMIT ?`)
        .all(
          position,
          loomId ?? null,
          loomId ?? null,
          phase ?? null,
          phase ?? null,
          limit + 1,
        );
      const result = page(rows, limit, scope, (row) => row.position as number);
      return {
        ...result,
        entries: result.entries.map(
          (row) => JSON.parse(row.record as string) as RunRecord,
        ),
      };
    },
    events(runId: string, raw: PageOptions = {}) {
      requireRun(runId);
      const { cursor, limit } = pageOptionsSchema.parse(raw);
      const scope = cursorScope([dataDir, "run-events", runId]);
      const position = cursorPosition(cursor, scope) ?? 0;
      if (typeof position !== "number")
        throw new Error("Invalid Run event cursor position");
      const events = database
        .prepare(`SELECT sequence, record FROM run_events
        WHERE run_id = ? AND sequence > ? ORDER BY sequence LIMIT ?`)
        .all(runId, position, limit + 1)
        .map(
          (row) =>
            ({
              ...JSON.parse(row.record as string),
              sequence: row.sequence as number,
              cursor: Buffer.from(
                JSON.stringify({ version: 1, scope, position: row.sequence }),
              ).toString("base64url"),
            }) as RunEvent,
        );
      return page(events, limit, scope, (event) => event.sequence);
    },
    subscribe(runId: string, listener: () => void) {
      changes.on(runId, listener);
      return () => {
        changes.off(runId, listener);
      };
    },
    claim(owner: RuntimeOwner) {
      transaction(database, () => {
        const row = database
          .prepare("SELECT record FROM runtime_owner WHERE singleton = 1")
          .get();
        if (row) {
          const previous = JSON.parse(row.record as string) as RuntimeOwner;
          let alive = true;
          try {
            process.kill(previous.pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
            alive = false;
          }
          if (alive)
            throw new Error(
              `A runtime already owns this dataDir (pid ${previous.pid})`,
            );
        }
        database
          .prepare(
            "INSERT OR REPLACE INTO runtime_owner (singleton, record) VALUES (1, ?)",
          )
          .run(JSON.stringify(owner));
        const rows = database
          .prepare("SELECT record FROM runs WHERE phase != 'finished'")
          .all();
        for (const row of rows) {
          const run = JSON.parse(row.record as string) as RunRecord;
          if (run.interruption) continue;
          const interruption = {
            detectedAt: new Date().toISOString(),
            phase: run.phase,
            reason: "Scheduling host exited before finalization",
          };
          const record = {
            ...run,
            interruption,
            updatedAt: interruption.detectedAt,
          };
          database
            .prepare("UPDATE runs SET record = ? WHERE run_id = ?")
            .run(JSON.stringify(record), run.runId);
          append(
            run.runId,
            { type: "interrupted", data: interruption },
            interruption.detectedAt,
          );
        }
      });
    },
    release(owner: RuntimeOwner) {
      database
        .prepare(
          "DELETE FROM runtime_owner WHERE singleton = 1 AND json_extract(record, '$.id') = ?",
        )
        .run(owner.id);
    },
  };
}

export type RunRecords = ReturnType<typeof runRecords>;
