import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import {
  copyPackageTestWorkspace,
  packageTestArtifactPaths,
  packageTestDirectories,
} from "./package-test-artifacts.ts";
import { publications, repositoryRoot } from "./publication.ts";
import { archiveName, readVersions } from "./release.ts";

async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), "intloom-artifact-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of new Set([
    ...publications.map((item) => item.directory),
    "packages/kernel",
  ])) {
    await mkdir(resolve(root, path), { recursive: true });
    await cp(
      resolve(repositoryRoot, path, "package.json"),
      resolve(root, path, "package.json"),
    );
  }
  for (const path of packageTestDirectories) {
    await mkdir(resolve(root, path), { recursive: true });
    await writeFile(resolve(root, path, "index.js"), "export {};\n");
  }
  await mkdir(resolve(root, ".release"));
  const versions = await readVersions(root);
  for (const { name } of publications)
    await writeFile(
      resolve(root, ".release", archiveName(name, versions[name])),
      "archive placeholder",
    );
  return root;
}

test("artifact transfer includes private fixture builds and only current package versions", async (t) => {
  const root = await fixture(t);
  await writeFile(
    resolve(root, ".release/intloom-cli-0.0.0.tgz"),
    "old archive",
  );
  const paths = await packageTestArtifactPaths(root);
  assert.ok(paths.includes("packages/kernel/dist"));
  assert.equal(
    paths.filter((path) => path.endsWith(".tgz")).length,
    publications.length,
  );
  assert.ok(!paths.includes(".release/intloom-cli-0.0.0.tgz"));
});

test("every required build and archive must be present even when other artifacts exist", async (t) => {
  const root = await fixture(t);
  const paths = await packageTestArtifactPaths(root);
  for (const path of paths) {
    const file = resolve(root, path);
    await rename(file, `${file}.saved`);
    await assert.rejects(packageTestArtifactPaths(root), (error: Error) =>
      error.message.endsWith(path),
    );
    await rename(`${file}.saved`, file);
  }
  await rm(resolve(root, "packages/kernel/dist/index.js"));
  await assert.rejects(
    packageTestArtifactPaths(root),
    /packages\/kernel\/dist/,
  );
  await writeFile(
    resolve(root, "packages/kernel/dist/index.js"),
    "export {};\n",
  );
  const archive = paths.find((path) => path.endsWith(".tgz"));
  assert.ok(archive);
  await writeFile(resolve(root, archive), "");
  await assert.rejects(
    packageTestArtifactPaths(root),
    /Missing or empty package test artifact/,
  );
});

test("clean staging exposes an omitted runtime build instead of using the developer checkout", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "intloom-artifact-isolation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, "source");
  const staged = resolve(root, "staged");
  const files = {
    "probe.mjs":
      'import { value } from "./packages/kernel/dist/host/index.js"; if (value !== 42) throw Error("bad build");',
    "packages/kernel/dist/host/index.js": "export const value = 42;",
    "node_modules/local-only/index.js": "export {};",
    ".turbo/local-cache": "cached",
  };
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(resolve(source, path)), { recursive: true });
    await writeFile(resolve(source, path), contents);
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  delete env.NODE_TEST_CONTEXT;
  const run = (cwd: string) =>
    spawnSync(process.execPath, ["probe.mjs"], { cwd, env, encoding: "utf8" });
  assert.equal(run(source).status, 0);
  await copyPackageTestWorkspace(source, staged, ["probe.mjs"], []);
  assert.deepEqual(await readdir(staged), ["probe.mjs"]);
  const failed = run(staged);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /ERR_MODULE_NOT_FOUND/);
  await copyPackageTestWorkspace(
    source,
    staged,
    ["probe.mjs"],
    ["packages/kernel/dist"],
  );
  assert.equal(run(staged).status, 0);
});
