import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chmod,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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

test("missing command or cwd is a nonzero result before execution, while capability boundaries remain fatal", async (t) => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "project-command-input-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = createProjectAccess(root);
  const missing = await p.run({
    command: join(root, "missing-executable"),
    args: [],
  });
  assert.equal(missing.exitCode, 127);
  assert.equal(missing.timedOut, false);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /executable.*command.*args/u);
  const command = {
    command: process.execPath,
    args: ["-e", 'require("node:fs").writeFileSync("executed", "bad")'],
  };
  for (const cwd of ["missing-directory", "regular-file"]) {
    await writeFile(join(root, "regular-file"), "file");
    const result = await p.run({ ...command, cwd });
    assert.equal(result.exitCode, 126);
    assert.match(result.stderr, /working directory/u);
    assert.equal((await p.snapshot()).executed, undefined);
  }
  await assert.rejects(
    p.run({ ...command, cwd: "../outside" }),
    /business file/u,
  );
  await symlink(root, join(root, "linked"));
  await assert.rejects(p.run({ ...command, cwd: "linked" }), /symbolic/u);
  const canceled = new AbortController();
  canceled.abort(new Error("canceled before launch"));
  await assert.rejects(
    p.run({ command: "missing", args: [] }, canceled.signal),
    /canceled before launch/u,
  );
  if (process.platform !== "win32") {
    const denied = join(root, "denied-executable");
    await writeFile(denied, "#!/bin/sh\nexit 0\n");
    await chmod(denied, 0o600);
    await assert.rejects(p.run({ command: denied, args: [] }), {
      code: "EACCES",
    });
  }
  await rm(root, { recursive: true, force: true });
  await assert.rejects(p.run({ command: "missing", args: [] }), {
    code: "ENOENT",
  });
});
