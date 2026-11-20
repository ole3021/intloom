import type { DatabaseSync } from "node:sqlite";
import { executionSchema, runSchema } from "./schema.ts";

export function migrateSystem(database: DatabaseSync, version: number): void {
  if (version !== 1)
    throw new Error(`Unsupported database schema version: ${version}`);
  database.exec(`
    ALTER TABLE events RENAME TO old_events;
    ALTER TABLE executions RENAME TO old_executions;
    DROP INDEX events_execution;
    DROP INDEX executions_loom;
    DROP INDEX executions_run;
    DROP INDEX executions_status;
    ${executionSchema}
    INSERT INTO executions
      (position, execution_id, mode, run_id, parent_id, loom_id, version, status, record)
      SELECT position, execution_id, 'run', run_id, parent_id, loom_id, version, status,
        json_set(record, '$.mode', 'run') FROM old_executions;
    INSERT INTO events (sequence, execution_id, record)
      SELECT sequence, execution_id,
        CASE WHEN json_extract(record, '$.type') = 'recorded'
          THEN json_set(record, '$.data.mode', 'run') ELSE record END
      FROM old_events;
    DROP TABLE old_events;
    DELETE FROM old_executions;
    DROP TABLE old_executions;
    ${runSchema}
  `);
}
