import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectAccess, bindProjectAccess } from "./access.ts";
test("project access hashes real files and rejects traversal, secrets and symlinks", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "project-access-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = createProjectAccess(root);
  await p.write("src/a.ts", "one");
  const before = await p.snapshot();
  await p.write("src/a.ts", "two");
  assert.notEqual((await p.snapshot())["src/a.ts"], before["src/a.ts"]);
  await writeFile(join(root, ".env"), "secret");
  assert.deepEqual(Object.keys(await p.snapshot()), ["src/a.ts"]);
  for (const path of [
    "../escape",
    ".env",
    "./intloom.yaml",
    "/tmp/escape",
    "node_modules/a",
  ])
    await assert.rejects(p.write(path, "bad"));
  await symlink(join(root, "src"), join(root, "linked"));
  await assert.rejects(p.read("linked/a.ts"), /symbolic/);
  await assert.rejects(p.snapshot(), /symbolic/);
  await p.remove("src/a.ts");
  await assert.rejects(p.read("src/a.ts"));
});
test("host command captures failed checks, timeout, cancellation and stale ownership", async (t) => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "project-command-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = createProjectAccess(root);
  const failed = await p.run({
    command: process.execPath,
    args: ["-e", 'console.error("failed");process.exit(7)'],
  });
  assert.equal(failed.exitCode, 7);
  assert.match(failed.stderr, /failed/);
  const timed = await p.run({
    command: process.execPath,
    args: ["-e", "setInterval(()=>{},100)"],
    timeoutMs: 30,
  });
  assert.equal(timed.timedOut, true);
  assert.equal(timed.exitCode, null);
  const controller = new AbortController();
  let active = true;
  const scoped = bindProjectAccess(
    p,
    () => {
      if (!active) throw new Error("lost owner");
    },
    controller.signal,
  );
  const running = scoped.run({
    command: process.execPath,
    args: ["-e", "setInterval(()=>{},100)"],
  });
  const rejected = assert.rejects(running, /lost owner/);
  setTimeout(() => {
    active = false;
    controller.abort();
  }, 30);
  await rejected;
  await assert.rejects(scoped.write("late", "no"), /lost owner/);
});
