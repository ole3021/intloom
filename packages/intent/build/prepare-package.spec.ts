import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { preparePackage } from "./prepare-package.ts";

test("derives a root-entry manifest and resolves workspace dependency versions", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "intent-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, "dist"));
  await mkdir(resolve(root, "node_modules/@intloom/dependency"), {
    recursive: true,
  });
  await writeFile(
    resolve(root, "node_modules/@intloom/dependency/package.json"),
    JSON.stringify({
      name: "@intloom/dependency",
      version: "1.2.3",
      exports: { ".": "./index.js" },
    }),
  );
  await writeFile(
    resolve(root, "node_modules/@intloom/dependency/index.js"),
    "export {};",
  );
  const source = {
    name: "@intloom/fixture",
    version: "2.0.0",
    private: true,
    type: "module",
    exports: {
      ".": {
        types: "./dist/workflow.generated.d.ts",
        default: "./dist/workflow.generated.js",
      },
      "./package.json": "./package.json",
    },
    intloom: { type: "workflow", version: "2026-10-08" },
    dependencies: { "@intloom/dependency": "workspace:*", zod: "^4.6.5" },
    peerDependencies: { "@intloom/dependency": "workspace:^" },
    devDependencies: { "@intloom/compiler": "workspace:*" },
    scripts: { build: "node build.ts" },
    files: ["dist"],
  };
  const text = JSON.stringify(source);
  await writeFile(resolve(root, "package.json"), text);
  await writeFile(resolve(root, "README.md"), "Fixture package");
  for (const name of ["workflow.generated.js", "workflow.generated.d.ts"])
    await writeFile(resolve(root, "dist", name), "");
  await preparePackage(root);
  const output = JSON.parse(
    await readFile(resolve(root, "dist/package.json"), "utf8"),
  );
  assert.deepEqual(output.exports, {
    ".": {
      types: "./workflow.generated.d.ts",
      default: "./workflow.generated.js",
    },
    "./package.json": "./package.json",
  });
  assert.equal(output.dependencies["@intloom/dependency"], "1.2.3");
  assert.equal(output.peerDependencies["@intloom/dependency"], "^1.2.3");
  assert.equal(output.dependencies.zod, source.dependencies.zod);
  for (const field of ["private", "scripts", "devDependencies"])
    assert.equal(Object.hasOwn(output, field), false);
  assert.deepEqual(output.intloom, source.intloom);
  assert.equal(await readFile(resolve(root, "package.json"), "utf8"), text);
  assert.equal(
    await readFile(resolve(root, "dist/README.md"), "utf8"),
    "Fixture package",
  );
  await preparePackage(root);
  assert.deepEqual(
    JSON.parse(await readFile(resolve(root, "dist/package.json"), "utf8")),
    output,
  );

  source.dependencies["@intloom/dependency"] = "file:../dependency";
  await writeFile(resolve(root, "package.json"), JSON.stringify(source));
  await assert.rejects(
    preparePackage(root),
    /Local dependency cannot be published/,
  );
  assert.deepEqual(
    JSON.parse(await readFile(resolve(root, "dist/package.json"), "utf8")),
    output,
  );
});
