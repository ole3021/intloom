import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openStore } from "../dist/index.js";
import { fixture, kernelUrl } from "./fixtures/data.mjs";

test("Store values persist across processes, owners and independently closed handles", async (t) => {
  const { dataDir } = await fixture(t);
  const global = await openStore(undefined, { dataDir });
  const first = await openStore("@fixture/a", { dataDir });
  const second = await openStore("@fixture/a", { dataDir });
  const other = await openStore("@fixture/b", { dataDir });
  t.after(() =>
    Promise.all([global.close(), first.close(), second.close(), other.close()]),
  );
  const value = { text: "陈🌍", values: [null, false, 0, 1.5, ""] };
  await first.set("same", value);
  await global.set("same", "global");
  await other.set("same", "other");
  assert.deepEqual(await second.get("same"), value);
  await first.close();
  await second.set("same", { replaced: true });
  assert.deepEqual(await second.get("same"), { replaced: true });
  assert.equal(await global.get("same"), "global");
  assert.equal(await other.get("same"), "other");
  await assert.rejects(first.get("same"), /closed|not open/i);
  await second.set("null", null);
  assert.equal(await second.get("null"), null);
  assert.equal(await second.get("missing"), undefined);
  await second.delete("missing");
  await second.delete("same");
  assert.equal(await second.get("same"), undefined);
  await second.set("persisted", value);
  await second.close();
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { openStore } from ${JSON.stringify(kernelUrl)};
       const store = await openStore("@fixture/a", { dataDir: process.argv[1] });
       console.log(JSON.stringify(await store.get("persisted")));
       await store.close();`,
      dataDir,
    ],
    { encoding: "utf8" },
  );
  assert.deepEqual(JSON.parse(output), value);
});

test("Store validates JSON before replacing a value and paginates literal UTF-8 prefixes", async (t) => {
  const { root, dataDir } = await fixture(t);
  const store = await openStore("@fixture/a", { dataDir });
  const other = await openStore("@fixture/b", { dataDir });
  const separate = await openStore("@fixture/a", {
    dataDir: join(root, "separate"),
  });
  t.after(() => Promise.all([store.close(), other.close(), separate.close()]));
  await store.set("valid", "retained");
  const cycle = {};
  cycle.self = cycle;
  for (const value of [
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    new Date(),
    { omitted: undefined },
    [undefined],
    new Map(),
    () => {},
    cycle,
  ]) {
    await assert.rejects(store.set("valid", value));
    assert.equal(await store.get("valid"), "retained");
  }
  await store.delete("valid");
  const keys = [
    "",
    "a",
    "A",
    "陈",
    "🌍",
    "a%_1",
    "a%_2",
    "aXX",
    "a\0one",
    "a\0two",
  ];
  for (const key of keys) await store.set(key, key);
  assert.deepEqual(
    (await store.list()).entries.map((entry) => entry.key),
    [...keys].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))),
  );
  assert.deepEqual(
    (await store.list({ prefix: "a%_" })).entries.map((entry) => entry.key),
    ["a%_1", "a%_2"],
  );
  assert.deepEqual(
    (await store.list({ prefix: "a\0" })).entries.map((entry) => entry.key),
    ["a\0one", "a\0two"],
  );
  const first = await store.list({ prefix: "a%_", limit: 1 });
  assert.ok(first.nextCursor);
  await store.delete("a%_1");
  await store.set("a%_3", "new");
  const second = await store.list({ prefix: "a%_", cursor: first.nextCursor });
  assert.deepEqual(
    second.entries.map((entry) => entry.key),
    ["a%_2", "a%_3"],
  );
  assert.equal(second.nextCursor, undefined);
  await assert.rejects(store.list({ cursor: first.nextCursor }), /query/);
  await assert.rejects(
    other.list({ prefix: "a%_", cursor: first.nextCursor }),
    /query/,
  );
  await assert.rejects(
    separate.list({ prefix: "a%_", cursor: first.nextCursor }),
    /query/,
  );
  for (const limit of [0, -1, 1.5, 1001])
    await assert.rejects(store.list({ limit }));
  await assert.rejects(store.list({ cursor: "invalid" }));
  for (let index = 0; index < 101; index++)
    await store.set(`page/${index}`, index);
  const defaults = await store.list({ prefix: "page/" });
  assert.equal(defaults.entries.length, 100);
  assert.ok(defaults.nextCursor);
  assert.equal(
    (await store.list({ prefix: "page/", cursor: defaults.nextCursor })).entries
      .length,
    1,
  );
});

test("SQLite lock waiting is bounded and newer schema versions preserve their data", async (t) => {
  const { dataDir } = await fixture(t);
  const store = await openStore(undefined, { dataDir });
  t.after(() => store.close());
  const database = new DatabaseSync(join(dataDir, "store.sqlite"));
  t.after(() => database.close());
  database.exec("BEGIN IMMEDIATE");
  try {
    await assert.rejects(store.set("locked", true), /locked/);
  } finally {
    database.exec("ROLLBACK");
  }
  await store.set("retained", true);
  database.exec("PRAGMA user_version = 2");
  await store.close();
  await assert.rejects(openStore(undefined, { dataDir }), /schema version: 2/);
  assert.equal(
    database.prepare("SELECT value FROM kv WHERE key = 'retained'").get().value,
    "true",
  );
  assert.equal(database.prepare("PRAGMA user_version").get().user_version, 2);
});
