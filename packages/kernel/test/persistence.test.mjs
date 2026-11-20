import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openKernelData } from "../dist/index.js";
import { fixture } from "./fixtures/data.mjs";
import { interaction, runtimeFixture } from "./fixtures/runtime.mjs";

test("Run phase and event roll back together if an event write fails", {
  timeout: 20_000,
}, async (t) => {
  const { dataDir, kernel, start } = await runtimeFixture(t, {
    source: `export default async function main(_, context) { await context.user.ask({ question: "Wait", mode: "confirm" }); }`,
  });
  const { runId } = await start();
  await interaction(kernel, runId);
  const before = await kernel.getRun(runId);
  const events = await kernel.listRunEvents(runId);
  const database = new DatabaseSync(join(dataDir, "system.sqlite"));
  try {
    database.exec(
      "CREATE TRIGGER fail_run_events BEFORE INSERT ON run_events BEGIN SELECT RAISE(FAIL, 'injected Run event failure'); END",
    );
    await assert.rejects(kernel.cancelRun(runId), /injected Run event/);
    assert.deepEqual(await kernel.getRun(runId), before);
    assert.deepEqual(await kernel.listRunEvents(runId), events);
    database.exec("DROP TRIGGER fail_run_events");
    await kernel.cancelRun(runId);
    assert.equal((await kernel.waitRun(runId)).execution.status, "cancelled");
  } finally {
    database.close();
  }
});

const versionOne = `
  CREATE TABLE installations (name TEXT NOT NULL, version TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(name, version)) STRICT;
  CREATE TABLE executions (
    position INTEGER PRIMARY KEY, execution_id TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL,
    parent_id TEXT REFERENCES executions(execution_id), loom_id TEXT NOT NULL, version TEXT NOT NULL,
    status TEXT NOT NULL, record TEXT NOT NULL,
    FOREIGN KEY (loom_id, version) REFERENCES installations(name, version)
  ) STRICT;
  CREATE INDEX executions_loom ON executions(loom_id, position);
  CREATE INDEX executions_run ON executions(run_id, position);
  CREATE INDEX executions_status ON executions(status, position);
  CREATE TABLE events (sequence INTEGER PRIMARY KEY, execution_id TEXT NOT NULL REFERENCES executions(execution_id), record TEXT NOT NULL) STRICT;
  CREATE INDEX events_execution ON events(execution_id, sequence);
  PRAGMA user_version = 1;
`;

test("system v1 migration preserves identities, parentage and event positions without fabricating Runs", async (t) => {
  const { dataDir } = await fixture(t);
  await mkdir(dataDir);
  const database = new DatabaseSync(join(dataDir, "system.sqlite"));
  database.exec(versionOne);
  const packageIdentity = { name: "@fixture/history", version: "1.0.0" };
  database
    .prepare("INSERT INTO installations VALUES (?, ?, ?)")
    .run(
      packageIdentity.name,
      packageIdentity.version,
      JSON.stringify({ package: packageIdentity }),
    );
  const runId = randomUUID();
  const parentId = randomUUID();
  const records = [parentId, randomUUID()].map((executionId, index) => ({
    executionId,
    runId,
    package: packageIdentity,
    kind: "code",
    createdAt: "2026-11-15T00:00:00.000Z",
    ...(index ? { parentId } : {}),
  }));
  for (const [index, record] of records.entries()) {
    database
      .prepare("INSERT INTO executions VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        10 + index,
        record.executionId,
        runId,
        record.parentId ?? null,
        packageIdentity.name,
        packageIdentity.version,
        "recorded",
        JSON.stringify(record),
      );
    database.prepare("INSERT INTO events VALUES (?, ?, ?)").run(
      40 + index,
      record.executionId,
      JSON.stringify({
        type: "recorded",
        executionId: record.executionId,
        at: record.createdAt,
        data: record,
      }),
    );
  }
  database.close();
  const data = await openKernelData({ dataDir });
  try {
    assert.deepEqual(
      (await data.listExecutions()).entries,
      records.map((record) => ({ ...record, mode: "run" })),
    );
    assert.equal(
      (await data.listEvents(records[1].executionId)).entries[0].sequence,
      41,
    );
    assert.equal((await data.listEvents(parentId)).entries[0].data.mode, "run");
    assert.deepEqual((await data.listRuns()).entries, []);
    await data.completeExecution(records[1].executionId, {
      result: { status: "succeeded" },
      value: null,
    });
    assert.equal(
      (await data.listEvents(records[1].executionId)).entries[1].sequence,
      42,
    );
    const chat = await data.createExecution({
      package: packageIdentity,
      kind: "code",
      mode: "chat",
    });
    assert.equal("runId" in chat, false);
    const child = await data.createExecution({
      package: packageIdentity,
      kind: "code",
      parentId: chat.executionId,
    });
    assert.equal(child.mode, "chat");
    assert.equal("runId" in child, false);
    const patch = await data.createExecution({
      package: packageIdentity,
      kind: "agent",
      mode: "patch",
      runId,
      patchId: "PCH-0001",
    });
    const patchChild = await data.createExecution({
      package: packageIdentity,
      kind: "code",
      parentId: patch.executionId,
    });
    assert.equal(patchChild.patchId, "PCH-0001");
    await assert.rejects(
      data.createExecution({ package: packageIdentity, kind: "code" }),
    );
  } finally {
    await data.close();
  }
  const inspect = new DatabaseSync(join(dataDir, "system.sqlite"));
  assert.equal(inspect.prepare("PRAGMA user_version").get().user_version, 2);
  assert.deepEqual(inspect.prepare("PRAGMA foreign_key_check").all(), []);
  inspect.close();
});

test("failed migration rolls back schema, records and version atomically", async (t) => {
  const { dataDir } = await fixture(t);
  await mkdir(dataDir);
  const path = join(dataDir, "system.sqlite");
  const database = new DatabaseSync(path);
  database.exec(versionOne);
  const id = randomUUID();
  database
    .prepare("INSERT INTO installations VALUES ('fixture', '1.0.0', '{}')")
    .run();
  database
    .prepare(
      "INSERT INTO executions VALUES (7, ?, ?, NULL, 'fixture', '1.0.0', 'recorded', 'invalid json')",
    )
    .run(id, randomUUID());
  database.close();
  await assert.rejects(openKernelData({ dataDir }), /malformed JSON/);
  const inspect = new DatabaseSync(path);
  try {
    assert.equal(inspect.prepare("PRAGMA user_version").get().user_version, 1);
    assert.equal(
      inspect.prepare("SELECT position FROM executions").get().position,
      7,
    );
    assert.equal(
      inspect
        .prepare("SELECT name FROM sqlite_master WHERE name = 'old_executions'")
        .get(),
      undefined,
    );
    assert.equal(
      inspect
        .prepare("SELECT name FROM sqlite_master WHERE name = 'runs'")
        .get(),
      undefined,
    );
  } finally {
    inspect.close();
  }
});
