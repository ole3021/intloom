import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";
import { installDevCli } from "./install-dev-cli.ts";

const run = promisify(execFile);

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-dev-launcher-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const checkout = join(directory, "checkout ' $ ` with spaces");
  const binDirectory = join(directory, "bin");
  const cwd = join(directory, "caller project");
  await mkdir(checkout);
  await mkdir(cwd);
  const entryPath = join(checkout, "bin.mjs");
  await writeFile(
    entryPath,
    "console.log(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), node: process.execPath }));\n",
  );
  const options = { binDirectory, entryPath, nodePath: process.execPath };
  return { ...options, options, cwd, directory };
}

test("dev launcher preserves full arguments and caller directory with a pinned Node", async (t) => {
  const f = await fixture(t);
  const launcher = await installDevCli(f.options);
  assert.ok((await lstat(launcher)).mode & 0o111);
  const argv = [
    "flow",
    "--intent",
    "中文第一行\n' $HOME $(touch unexpected) `echo wrong`",
    "",
    "--json",
  ];
  const alias = join(f.directory, "caller alias");
  await symlink(f.cwd, alias, "dir");
  for (const cwd of [f.cwd, alias]) {
    const { stdout } = await run(launcher, argv, {
      cwd,
      env: { ...process.env, PATH: "/nonexistent" },
    });
    const result = JSON.parse(stdout);
    assert.deepEqual(result.argv, argv);
    assert.equal(result.cwd, await realpath(cwd));
    assert.equal(result.node, await realpath(process.execPath));
  }
});

test("dev launcher reads rebuilt output without reinstalling and returns the CLI exit code", async (t) => {
  const f = await fixture(t);
  const launcher = await installDevCli(f.options);
  await writeFile(
    f.entryPath,
    'console.log("rebuilt"); process.exitCode = 7;\n',
  );
  await assert.rejects(run(launcher, [], { cwd: f.cwd }), (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error && "stdout" in error);
    assert.equal(error.code, 7);
    assert.equal(error.stdout, "rebuilt\n");
    return true;
  });
  const before = await readFile(launcher, "utf8");
  assert.equal(await installDevCli(f.options), launcher);
  assert.equal(await readFile(launcher, "utf8"), before);
});

test("dev installation rejects unmanaged files, symlinks and another checkout", async (t) => {
  const f = await fixture(t);
  const launcher = join(f.binDirectory, "intloom-dev");
  await mkdir(f.binDirectory);
  await writeFile(launcher, "unrelated command");
  await assert.rejects(installDevCli(f.options), /Refusing to replace/u);
  assert.equal(await readFile(launcher, "utf8"), "unrelated command");
  await rm(launcher);
  await symlink(f.entryPath, launcher);
  await assert.rejects(installDevCli(f.options), /Refusing to replace/u);
  assert.equal(
    await readFile(f.entryPath, "utf8"),
    "console.log(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), node: process.execPath }));\n",
  );
  await rm(launcher);
  await installDevCli(f.options);
  const before = await readFile(launcher, "utf8");
  const other = join(f.directory, "other.mjs");
  await writeFile(other, "");
  await assert.rejects(
    installDevCli({ ...f.options, entryPath: other }),
    /Refusing to replace/u,
  );
  assert.equal(await readFile(launcher, "utf8"), before);
});

test("missing build output leaves the installed launcher untouched", async (t) => {
  const f = await fixture(t);
  const launcher = await installDevCli(f.options);
  const before = await readFile(launcher, "utf8");
  await rm(f.entryPath);
  await assert.rejects(installDevCli(f.options), { code: "ENOENT" });
  assert.equal(await readFile(launcher, "utf8"), before);
});
