import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  append,
  create,
  payload,
  storageContract,
  storageDirectory,
  storageCleanup,
} from "../../../test/storage-contract.ts";
import { openSqliteStorage } from "./open.ts";

storageContract("sqlite", (directory) =>
  openSqliteStorage({
    filename: join(directory, "store.sqlite"),
    projectId: "project",
  }),
);

test("sqlite: projects and independent connections preserve isolation and conditional writes", async (t) => {
  const filename = join(await storageDirectory(t), "store.sqlite");
  const first = await openSqliteStorage({ filename, projectId: "first" });
  storageCleanup(t, () => first.dispose());
  const same = await openSqliteStorage({ filename, projectId: "first" });
  storageCleanup(t, () => same.dispose());
  const other = await openSqliteStorage({ filename, projectId: "other" });
  storageCleanup(t, () => other.dispose());
  const entry = (await first.access.commit([create, append]))
    .writtenArtifacts[0];
  assert.ok(entry);
  assert.equal(await other.access.getArtifactById(entry.id), undefined);
  await assert.rejects(
    other.access.commit([{ type: "remove_record", id: "record" }]),
    { code: "NOT_FOUND" },
  );
  await other.access.commit([create, append]);
  await same.access.commit([
    {
      type: "replace_artifact",
      id: entry.id,
      expectedRevision: entry.revision,
      payload: { ...payload, data: "changed" },
    },
  ]);
  await assert.rejects(
    first.access.commit([
      {
        type: "replace_artifact",
        id: entry.id,
        expectedRevision: entry.revision,
        payload,
      },
    ]),
    { code: "CONFLICT" },
  );
  assert.deepEqual(
    (await other.access.getArtifactById(entry.id))?.data,
    payload.data,
  );
  await first.access.commit([{ ...append, id: "second" }]);
  const page = await first.access.listRecords({ limit: 1 });
  assert.ok(page.nextCursor);
  await assert.rejects(
    other.access.listRecords({ limit: 1, cursor: page.nextCursor }),
    { code: "INVALID_REQUEST" },
  );
});

test("sqlite: bounded lock failure does not partially write or close the handle", async (t) => {
  const filename = join(await storageDirectory(t), "store.sqlite");
  const handle = await openSqliteStorage({ filename, projectId: "project" });
  storageCleanup(t, () => handle.dispose());
  const blocker = new Database(filename);
  storageCleanup(t, () => blocker.close());
  blocker.exec("BEGIN IMMEDIATE");
  await assert.rejects(handle.access.commit([create, append]), {
    code: "BUSY",
    retryable: true,
  });
  blocker.exec("ROLLBACK");
  assert.equal(await handle.access.getRecordById("record"), undefined);
  await handle.access.commit([create, append]);
});

test("sqlite: refuses incompatible migration history without deleting data", async (t) => {
  const filename = join(await storageDirectory(t), "store.sqlite");
  const handle = await openSqliteStorage({ filename, projectId: "project" });
  await handle.access.commit([create]);
  await handle.dispose();
  const db = new Database(filename);
  storageCleanup(t, () => db.close());
  db.prepare("UPDATE __drizzle_migrations SET hash = ?").run("changed");
  await assert.rejects(openSqliteStorage({ filename, projectId: "project" }), {
    code: "STORAGE_ERROR",
    retryable: false,
  });
  assert.equal(
    db
      .prepare<[], { total: number }>("SELECT count(*) AS total FROM artifacts")
      .get()?.total,
    1,
  );
});
