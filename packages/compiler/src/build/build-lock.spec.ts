import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { withBuildLock } from "./build-lock.ts";

for (const fails of [false, true])
  test(`serializes package builds and releases its lock after failure=${fails}`, async (t) => {
    const root = await mkdtemp(resolve(tmpdir(), "compiler-lock-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const original = new Error("build failed");
    const work = withBuildLock(root, async () => {
      const owner = JSON.parse(
        await readFile(resolve(root, ".intloom-build.lock"), "utf8"),
      );
      assert.equal(owner.pid, process.pid);
      await assert.rejects(
        withBuildLock(root, async () => assert.fail("must not enter")),
        /Cannot acquire/,
      );
      if (fails) throw original;
      return 42;
    });
    if (fails) await assert.rejects(work, (error) => error === original);
    else assert.equal(await work, 42);
    await assert.rejects(access(resolve(root, ".intloom-build.lock")), {
      code: "ENOENT",
    });
  });

test("retains interrupted lock evidence and explains recovery without stealing a lock", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "compiler-lock-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = resolve(root, ".intloom-build.lock");
  const owner = JSON.stringify({ pid: 1234567, host: hostname() });
  await writeFile(file, owner);
  t.mock.method(process, "kill", () => {
    throw Object.assign(new Error("gone"), { code: "ESRCH" });
  });
  await assert.rejects(
    withBuildLock(root, async () => {}),
    /process has exited; inspect/,
  );
  assert.equal(await readFile(file, "utf8"), owner);
});
