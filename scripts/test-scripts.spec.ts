import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("the script test entry rejects an empty suite and propagates test failures", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-script-tests-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = join(root, "test-scripts.ts");
  await cp(new URL("./test-scripts.ts", import.meta.url), entry);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = () =>
    spawnSync(process.execPath, [entry], { encoding: "utf8", env });
  const empty = run();
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /No repository script tests found/);
  const file = join(root, "fixture.spec.ts");
  await writeFile(
    file,
    'import { test } from "node:test"; test("fixture", () => {});',
  );
  assert.equal(run().status, 0);
  await writeFile(
    file,
    'import { test } from "node:test"; test("fixture", () => { throw new Error("expected failure"); });',
  );
  const failed = run();
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /expected failure/);
});
