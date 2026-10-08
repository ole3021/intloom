import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { discoverWorkflows } from "./discover-workflows.ts";

test("discovers only direct Workflows, derives resources from entry and never imports", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "workflow-discovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ dependencies: { "@test/flow": "*", ordinary: "*" } }),
  );
  for (const name of ["@test/flow", "ordinary", "transitive"]) {
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
                types: "./dist/flow.d.ts",
                import: "./dist/flow.js",
                default: "./dist/flow.js",
              },
              "./package.json": "./package.json",
            }
          : { ".": "./dist/flow.js" },
        ...(isFlow
          ? { intloom: { type: "workflow", version: "2026-10-08" } }
          : {}),
      }),
    );
    await writeFile(
      resolve(directory, "dist/flow.js"),
      "throw new Error('discovery must not import');",
    );
  }
  const discovery = await discoverWorkflows(root);
  const workflows = discovery.sources;
  assert.deepEqual(discovery.failures, []);
  assert.equal(workflows.length, 1);
  const workflow = workflows[0];
  assert.ok(workflow);
  assert.equal(workflow.packageName, "@test/flow");
  assert.equal(workflow.assetRoot, resolve(workflow.packageRoot, "dist"));
  assert.equal(
    fileURLToPath(workflow.entryUrl),
    resolve(workflow.assetRoot, "flow.js"),
  );
  const file = resolve(workflow.packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.intloom.version = "2026-09-20";
  await writeFile(file, JSON.stringify(manifest));
  const unsupported = await discoverWorkflows(root);
  assert.equal(unsupported.sources.length, 0);
  assert.equal(
    unsupported.failures[0]?.error.code,
    "UNSUPPORTED_WORKFLOW_PROTOCOL",
  );
  assert.equal(unsupported.failures[0]?.isAvailable, false);
  manifest.intloom.version = "2026-10-08";
  manifest.exports["."].import = "./dist/other.js";
  await writeFile(file, JSON.stringify(manifest));
  const mismatched = await discoverWorkflows(root);
  assert.match(
    mismatched.failures[0]?.error.message ?? "",
    /import\/default entries differ/,
  );
});
