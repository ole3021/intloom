import assert from "node:assert/strict";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openKernelData, openStore } from "../dist/index.js";
import { fixture } from "./fixtures/data.mjs";

test("Kernel owns its Store handles and rejects newer system schemas", async (t) => {
  const { dataDir } = await fixture(t);
  const data = await openKernelData({ dataDir });
  const owned = await data.getStore("@fixture/owned");
  const independent = await openStore("@fixture/owned", { dataDir });
  t.after(() => independent.close());
  assert.equal(owned.close, undefined);
  await owned.set("shared", true);
  assert.equal(await independent.get("shared"), true);
  await data.close();
  await data.close();
  await assert.rejects(owned.get("shared"), /closed|not open/i);
  await assert.rejects(data.getStore("@fixture/owned"), /closed/);
  assert.equal(await independent.get("shared"), true);
  const database = new DatabaseSync(join(dataDir, "system.sqlite"));
  database.exec("PRAGMA user_version = 3");
  database.close();
  await assert.rejects(openKernelData({ dataDir }), /schema version: 3/);
});
