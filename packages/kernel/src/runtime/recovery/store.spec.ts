import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, type TestContext } from "node:test";
import { createRun } from "../create-run.ts";
import { runtimeFixture } from "../../../test/runtime-fixture.ts";
import { openRunCheckpointStore, checkpointSchema } from "./store.ts";

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "checkpoint-store-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, "runtime");
  const store = openRunCheckpointStore(directory);
  const saved = checkpointSchema.parse(
    JSON.parse(
      JSON.stringify({
        version: 1,
        workflowIdentity: "one",
        phase: "stage_pending",
        run: createRun(runtimeFixture().blueprint, "intent"),
      }),
    ),
  );
  return { root, directory, store, saved };
}

test("atomic replacement reopens a complete checkpoint with private file permissions", (t) => {
  const f = fixture(t);
  f.store.write(f.saved);
  const [filename] = readdirSync(f.directory);
  assert.ok(filename);
  assert.equal(statSync(join(f.directory, filename)).mode & 0o777, 0o600);
  const updated = { ...f.saved, run: { ...f.saved.run, intent: "new intent" } };
  f.store.write(updated);
  assert.deepEqual(openRunCheckpointStore(f.directory).read(), [updated]);
  assert.deepEqual(readdirSync(f.directory), [filename]);
});

test("manual removal does not recreate this process's recovery files or directory", (t) => {
  const f = fixture(t);
  f.store.write(f.saved);
  rmSync(f.directory, { recursive: true });
  f.store.write(f.saved);
  assert.throws(() => statSync(f.directory), { code: "ENOENT" });
  assert.deepEqual(openRunCheckpointStore(f.directory).read(), []);
  f.store.write(f.saved);
  assert.deepEqual(readdirSync(f.directory), []);
});

test("symbolic checkpoint replacement is rejected without modifying its target", (t) => {
  const f = fixture(t);
  f.store.write(f.saved);
  const savedName = readdirSync(f.directory)[0];
  assert.ok(savedName);
  const filename = join(f.directory, savedName);
  const external = join(f.root, "external");
  writeFileSync(external, "keep");
  rmSync(filename);
  symlinkSync(external, filename);
  assert.throws(() => f.store.write(f.saved), /symbolic/);
  assert.equal(readFileSync(external, "utf8"), "keep");
  assert.throws(() => openRunCheckpointStore(f.directory).read());
});

test("a failed checkpoint publication preserves the previous checkpoint and rejects later writes", (t) => {
  const f = fixture(t);
  f.store.write(f.saved);
  const savedName = readdirSync(f.directory)[0];
  assert.ok(savedName);
  const path = join(f.directory, savedName);
  const prior = readFileSync(path, "utf8");
  // A directory where the target file belongs makes rename fail without any permission-dependent assumptions.
  rmSync(path);
  const other = openRunCheckpointStore(path);
  assert.ok(other);
  assert.throws(() => f.store.write(f.saved));
  rmSync(path, { recursive: true });
  writeFileSync(path, prior);
  assert.throws(() => f.store.write(f.saved));
  assert.equal(readFileSync(path, "utf8"), prior);
});
