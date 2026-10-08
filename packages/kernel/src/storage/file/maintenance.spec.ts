import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs, { chmod, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import {
  storageDirectory,
  storageCleanup,
} from "../../../test/storage-contract.ts";
import { openFileStorage } from "./open.ts";
import {
  inspectFileStorageLock,
  recoverFileStorageLock,
} from "./maintenance.ts";

test("file maintenance is read-only and refuses a live owner", async (t) => {
  const directory = await storageDirectory(t);
  assert.equal(await inspectFileStorageLock({ directory }), undefined);
  const handle = await openFileStorage({ directory });
  storageCleanup(t, () => handle.dispose());
  const expected = await inspectFileStorageLock({ directory });
  assert.ok(expected);
  const before = await readFile(join(directory, "store.lock"));
  await assert.rejects(recoverFileStorageLock({ directory, expected }), {
    code: "BUSY",
  });
  assert.deepEqual(await readFile(join(directory, "store.lock")), before);
});

test("file maintenance observes a lock removed between inspection and reading as released", async (t) => {
  const directory = await storageDirectory(t);
  const filename = join(directory, "store.lock");
  await writeFile(
    filename,
    JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
  const lstat = fs.lstat;
  t.mock.method(fs, "lstat", async (...args: Parameters<typeof lstat>) => {
    const info = await lstat(...args);
    if (args[0] === filename) await rm(filename);
    return info;
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  assert.equal(await inspectFileStorageLock({ directory }), undefined);
});

test("file maintenance removes only a matching absent owner and preserves data", async (t) => {
  const directory = await storageDirectory(t);
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  assert.ok(child.pid);
  const expected = { pid: child.pid, createdAt: new Date().toISOString() };
  await writeFile(join(directory, "store.lock"), JSON.stringify(expected), {
    mode: 0o600,
  });
  await writeFile(join(directory, "store.json"), "data must stay unchanged");
  await assert.rejects(
    recoverFileStorageLock({
      directory,
      expected: { ...expected, createdAt: "2000-01-01T00:00:00.000Z" },
    }),
    { code: "CONFLICT" },
  );
  t.mock.method(process, "kill", () => {
    throw Object.assign(new Error("unknown owner"), { code: "EPERM" });
  });
  await assert.rejects(recoverFileStorageLock({ directory, expected }), {
    code: "STORAGE_ERROR",
  });
  assert.ok(await inspectFileStorageLock({ directory }));
  t.mock.restoreAll();
  await recoverFileStorageLock({ directory, expected });
  assert.equal(await inspectFileStorageLock({ directory }), undefined);
  assert.equal(
    await readFile(join(directory, "store.json"), "utf8"),
    "data must stay unchanged",
  );
});

test("file maintenance rejects malformed, public and symlink locks", async (t) => {
  const directory = await storageDirectory(t);
  const filename = join(directory, "store.lock");
  await writeFile(filename, "{broken", { mode: 0o600 });
  await assert.rejects(inspectFileStorageLock({ directory }), {
    code: "STORAGE_ERROR",
  });
  if (process.platform !== "win32") {
    await writeFile(
      filename,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    );
    await chmod(filename, 0o644);
    await assert.rejects(inspectFileStorageLock({ directory }), {
      code: "STORAGE_ERROR",
    });
  }
  const linkDirectory = join(directory, "link");
  await symlink(directory, linkDirectory, "dir");
  await assert.rejects(inspectFileStorageLock({ directory: linkDirectory }), {
    code: "STORAGE_ERROR",
  });
});
