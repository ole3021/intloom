import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  append,
  create,
  storageContract,
  storageDirectory,
  storageCleanup,
} from "../../../test/storage-contract.ts";
import { openFileStorage } from "./open.ts";

storageContract("file", (directory) => openFileStorage({ directory }));
storageContract("directories", (directory) =>
  openFileStorage({ directory, layout: "directories" }),
);

test("file: rejects duplicate opens and stale locks; initialization failure releases its own lock", async (t) => {
  const directory = await storageDirectory(t);
  const handle = await openFileStorage({ directory });
  storageCleanup(t, () => handle.dispose());
  await assert.rejects(openFileStorage({ directory }), { code: "BUSY" });
  await handle.dispose();
  await writeFile(
    join(directory, "store.lock"),
    JSON.stringify({ pid: 999999999 }),
  );
  await assert.rejects(openFileStorage({ directory }), { code: "BUSY" });
  await rm(join(directory, "store.lock"));
  await writeFile(join(directory, "store.json"), "{broken");
  await assert.rejects(openFileStorage({ directory }), {
    code: "STORAGE_ERROR",
    retryable: false,
  });
  await assert.rejects(readFile(join(directory, "store.lock")), {
    code: "ENOENT",
  });
  assert.equal(
    await readFile(join(directory, "store.json"), "utf8"),
    "{broken",
  );
});

test("file: failed atomic publication leaves the previous view and permits a later commit", async (t) => {
  const directory = await storageDirectory(t);
  const handle = await openFileStorage({ directory });
  storageCleanup(t, () => handle.dispose());
  await handle.access.commit([create]);
  await rename(join(directory, "store.json"), join(directory, "saved.json"));
  await mkdir(join(directory, "store.json"));
  await assert.rejects(handle.access.commit([append]), {
    code: "STORAGE_ERROR",
    retryable: false,
  });
  assert.equal(await handle.access.getRecordById("record"), undefined);
  await rm(join(directory, "store.json"), { recursive: true });
  await rename(join(directory, "saved.json"), join(directory, "store.json"));
  await handle.access.commit([append]);
  await handle.dispose();
  const next = await openFileStorage({ directory });
  storageCleanup(t, () => next.dispose());
  assert.equal((await next.access.listArtifacts({})).data.length, 1);
  assert.equal((await next.access.listRecords({})).data.length, 1);
});

test("file: unsupported format and invalid persisted identity are never reset", async (t) => {
  const directory = await storageDirectory(t);
  const initial = await openFileStorage({ directory });
  await initial.access.commit([create]);
  await initial.dispose();
  const filename = join(directory, "store.json");
  const store = JSON.parse(await readFile(filename, "utf8"));
  await writeFile(filename, JSON.stringify({ ...store, version: 2 }));
  await assert.rejects(openFileStorage({ directory }), {
    code: "STORAGE_ERROR",
  });
  await writeFile(
    filename,
    JSON.stringify({
      ...store,
      artifacts: [...store.artifacts, ...store.artifacts],
    }),
  );
  await assert.rejects(openFileStorage({ directory }), {
    code: "STORAGE_ERROR",
  });
});

test("file: a failure after rename invalidates the view and prevents queued writes until reopening", async (t) => {
  const directory = await storageDirectory(t);
  const handle = await openFileStorage({ directory });
  storageCleanup(t, () => handle.dispose());
  await handle.access.commit([create]);
  const { open } = await import("node:fs/promises");
  const probe = await open(directory, "r");
  const prototype: Pick<import("node:fs/promises").FileHandle, "sync"> =
    Object.getPrototypeOf(probe);
  const sync = prototype.sync;
  await probe.close();
  t.mock.method(
    prototype,
    "sync",
    async function (this: import("node:fs/promises").FileHandle) {
      if ((await this.stat()).isDirectory())
        throw new Error("injected directory sync failure");
      return sync.call(this);
    },
  );
  const results = await Promise.allSettled([
    handle.access.commit([append]),
    handle.access.commit([{ ...append, id: "must-not-write" }]),
  ]);
  assert.ok(results.every((result) => result.status === "rejected"));
  await assert.rejects(handle.access.getArtifactById("artifact"), {
    code: "STORAGE_ERROR",
    retryable: false,
  });
  t.mock.restoreAll();
  await handle.dispose();
  const next = await openFileStorage({ directory });
  storageCleanup(t, () => next.dispose());
  assert.equal((await next.access.getRecordById("record"))?.id, "record");
  assert.equal(await next.access.getRecordById("must-not-write"), undefined);
});
