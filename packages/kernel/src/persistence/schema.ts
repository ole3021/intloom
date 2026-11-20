export const executionSchema = `
  CREATE TABLE executions (
    position INTEGER PRIMARY KEY,
    execution_id TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    run_id TEXT,
    parent_id TEXT REFERENCES executions(execution_id),
    loom_id TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL,
    record TEXT NOT NULL,
    FOREIGN KEY (loom_id, version) REFERENCES installations(name, version)
  ) STRICT;
  CREATE INDEX executions_loom ON executions(loom_id, position);
  CREATE INDEX executions_run ON executions(run_id, position);
  CREATE INDEX executions_status ON executions(status, position);
  CREATE TABLE events (
    sequence INTEGER PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(execution_id),
    record TEXT NOT NULL
  ) STRICT;
  CREATE INDEX events_execution ON events(execution_id, sequence);
`;

export const runSchema = `
  CREATE TABLE runtime_owner (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    record TEXT NOT NULL
  ) STRICT;
  CREATE TABLE runs (
    position INTEGER PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE,
    loom_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    record TEXT NOT NULL
  ) STRICT;
  CREATE INDEX runs_loom ON runs(loom_id, position);
  CREATE TABLE run_events (
    sequence INTEGER PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    record TEXT NOT NULL
  ) STRICT;
  CREATE INDEX run_events_run ON run_events(run_id, sequence);
`;

export const systemSchema = `
  CREATE TABLE installations (
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    record TEXT NOT NULL,
    PRIMARY KEY (name, version)
  ) STRICT;
  ${executionSchema}
  ${runSchema}
`;
