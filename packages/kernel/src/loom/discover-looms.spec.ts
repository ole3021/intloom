import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { discoverLooms } from "./discover-looms.ts";

test("discovers only direct Looms, derives resources from entry and never imports", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "loom-discovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ dependencies: { "@test/run": "*", ordinary: "*" } }),
  );
  for (const name of ["@test/run", "ordinary", "transitive"]) {
    const directory = resolve(root, "node_modules", name);
    await mkdir(resolve(directory, "dist"), { recursive: true });
    const isFlow = name !== "ordinary";
    await writeFile(
      resolve(directory, "package.json"),
      JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        exports: isFlow
          ? {
              ".": {
                types: "./dist/run.d.ts",
                import: "./dist/run.js",
                default: "./dist/run.js",
              },
              "./package.json": "./package.json",
            }
          : { ".": "./dist/run.js" },
        ...(isFlow ? { loom: { type: "loom", version: "2026-10-15" } } : {}),
      }),
    );
    await writeFile(
      resolve(directory, "dist/run.js"),
      "throw new Error('discovery must not import');",
    );
  }
  const discovery = await discoverLooms(root);
  const looms = discovery.sources;
  assert.deepEqual(discovery.failures, []);
  assert.equal(looms.length, 1);
  const loom = looms[0];
  assert.ok(loom);
  assert.equal(loom.packageName, "@test/run");
  assert.equal(loom.assetRoot, resolve(loom.packageRoot, "dist"));
  assert.equal(fileURLToPath(loom.entryUrl), resolve(loom.assetRoot, "run.js"));
  const file = resolve(loom.packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.loom.version = "2026-09-20";
  await writeFile(file, JSON.stringify(manifest));
  const unsupported = await discoverLooms(root);
  assert.equal(unsupported.sources.length, 0);
  assert.equal(
    unsupported.failures[0]?.error.code,
    "UNSUPPORTED_LOOM_PROTOCOL",
  );
  assert.equal(unsupported.failures[0]?.isAvailable, false);
  manifest.loom.version = "2026-10-15";
  manifest.exports["."].import = "./dist/other.js";
  await writeFile(file, JSON.stringify(manifest));
  const mismatched = await discoverLooms(root);
  assert.match(
    mismatched.failures[0]?.error.message ?? "",
    /import\/default entries differ/,
  );
});
