import assert from "node:assert/strict";
import { readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { openKernelData } from "../dist/index.js";
import { fixture, prepared } from "./fixtures/data.mjs";

test("immutable name@version installations retain resources, dependencies and internal links", async (t) => {
  const { root, dataDir } = await fixture(t);
  const data = await openKernelData({ dataDir });
  t.after(() => data.close());
  const source = await prepared(root);
  const original = await data.registerInstallation({
    directory: source,
    packagePath: ".",
    source: "prepared fixture",
  });
  assert.deepEqual(original.package, {
    name: "@fixture/report",
    version: "1.0.0",
  });
  assert.deepEqual(original.dependencies, [
    {
      path: "node_modules/fixture-dependency",
      name: "fixture-dependency",
      version: "1.0.0",
    },
  ]);
  const execution = await data.createExecution({
    package: original.package,
    kind: "code",
    mode: "chat",
  });
  await writeFile(join(source, "assets/evidence.txt"), "changed");
  await assert.rejects(
    data.registerInstallation({ directory: source, packagePath: "." }),
    /already registered/,
  );
  const update = await data.registerInstallation({
    directory: await prepared(root, "1.1.0"),
    packagePath: ".",
  });
  assert.notEqual(original.directory, update.directory);
  assert.deepEqual(
    (await data.getExecution(execution.executionId)).package,
    original.package,
  );
  await rm(source, { recursive: true });
  assert.equal(
    await readFile(join(original.directory, "assets/evidence.txt"), "utf8"),
    "evidence 1.0.0",
  );
  assert.equal(
    (await import(pathToFileURL(join(original.directory, "main.js")).href))
      .label,
    "1.0.0",
  );
  assert.equal(
    await readFile(
      join(original.directory, "node_modules/.bin/fixture"),
      "utf8",
    ),
    'export const label = "1.0.0";\n',
  );
  await data.close();
  const reopened = await openKernelData({ dataDir });
  t.after(() => reopened.close());
  assert.deepEqual(await reopened.getInstallation(original.package), original);
});

test("installation boundary rejects mismatched identities and external links without registration", async (t) => {
  const { root, dataDir } = await fixture(t);
  const data = await openKernelData({ dataDir });
  t.after(() => data.close());
  const source = await prepared(root);
  const manifestPath = join(source, "loom.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.package.version = "2.0.0";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    data.registerInstallation({ directory: source, packagePath: "." }),
    /identity/,
  );
  manifest.package.version = "1.0.0";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(join(root, "external.txt"), "outside");
  await symlink("../external.txt", join(source, "external"), "file");
  await assert.rejects(
    data.registerInstallation({ directory: source, packagePath: "." }),
    /leaves/,
  );
  assert.equal(await data.getInstallation(manifest.package), undefined);
  assert.deepEqual(
    await readdir(
      join(
        dataDir,
        "looms",
        encodeURIComponent(manifest.package.name),
        "installations",
      ),
    ),
    [],
  );
  await assert.rejects(
    data.registerInstallation({
      directory: root,
      packagePath: "prepared-1.0.0",
    }),
    /outside/,
  );
});
