import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readdir,
  rm,
  utimes,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { retainLogs } from "./retention.ts";

test("retention removes only closed logs and preserves incomplete executions and unrelated files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-log-retention-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = "LOG-20200101T000000000Z.jsonl";
  const incomplete = "LOG-20200102T000000000Z.jsonl";
  await writeFile(join(root, old), '{"event":"log_closed"}\n');
  await chmod(join(root, old), 0o400);
  await writeFile(join(root, incomplete), '{"event":"run_started"}\n');
  await writeFile(join(root, "keep.txt"), "unrelated");
  await utimes(join(root, old), 0, 0);
  await utimes(join(root, incomplete), 0, 0);
  assert.ok((await retainLogs(root)) > 0);
  assert.deepEqual(
    (await readdir(root)).sort(),
    [incomplete, "keep.txt"].sort(),
  );
  assert.equal(await retainLogs(root, 1), 0);
  assert.deepEqual(
    (await readdir(root)).sort(),
    [incomplete, "keep.txt"].sort(),
  );
});
