import assert from "node:assert/strict";
import { test } from "node:test";
import { artifacts, invalidOutput } from "../../test/helpers/artifacts.ts";
import { verifyArtifacts } from "./verify-artifacts.ts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const [label, statement, message] of [
  [
    "missing relative import",
    'import "./missing.js";',
    /Missing emitted module/,
  ],
  ["directory import", 'import ".";', /Missing emitted module/],
  ["escaping import", 'import "../../outside.js";', /Import escapes output/],
  [
    "nonliteral dynamic import",
    'const path = "./missing.js"; import(path);',
    /string literals/,
  ],
  [
    "missing literal dynamic import",
    'import("./missing.js");',
    /Missing emitted module/,
  ],
  [
    "missing re-export dependency",
    'export * from "./missing.js";',
    /Missing emitted module/,
  ],
] satisfies [string, string, RegExp][]) {
  test(`rejects ${label}`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(codeFile, `${statement}\nexport default function run() {}`);
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(message),
    );
  });
}

test("accepts relative literal dynamic imports and Node builtins", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  await writeFile(
    resolve(output, "codes/helper.js"),
    "export const value = 1;",
  );
  await writeFile(
    codeFile,
    'import "node:fs"; import "path"; export default async function run() { return import("./helper.js"); }',
  );
  await verifyArtifacts(root, output, loom);
});

for (const field of [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "devDependencies",
] as const) {
  test(`checks external scoped subpath imports against ${field}`, async (t) => {
    const { root, output, loom, codeFile, manifest } = await artifacts(t);
    manifest[field]["@example/tool"] = "1.0.0";
    await writeFile(resolve(output, "package.json"), JSON.stringify(manifest));
    await writeFile(
      codeFile,
      'import "@example/tool/subpath"; export default function run() {}',
    );
    if (field === "devDependencies")
      await assert.rejects(
        verifyArtifacts(root, output, loom),
        invalidOutput(/Runtime dependency is not declared/),
      );
    else await verifyArtifacts(root, output, loom);
  });
}

for (const specifier of ["undeclared", "toString"]) {
  test(`rejects undeclared dependency ${specifier}`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(
      codeFile,
      `import ${JSON.stringify(specifier)}; export default function run() {}`,
    );
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Runtime dependency is not declared/),
    );
  });
}

for (const source of [
  'import type { Missing } from "dev-only"; export declare const value: Missing;',
  'export declare const value: import("dev-only").Missing;',
  'export type { Missing } from "dev-only";',
  '/// <reference types="dev-only" />\nexport {};',
])
  test(`rejects an undeclared type dependency: ${source}`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    await writeFile(resolve(output, "codes/types.d.ts"), source);
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Declaration dependency is not declared/),
    );
  });

for (const source of [
  'export type Value = import("./missing.js").Value;',
  '/// <reference path="./missing.d.ts" />\nexport {};',
  'export type Value = import("../../outside.js").Value;',
])
  test(`rejects missing or escaping declaration references: ${source}`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    await writeFile(resolve(output, "codes/types.d.ts"), source);
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Missing emitted declaration|escapes output/),
    );
  });

for (const file of ["extra.mjs", "extra.d.mts", "extra.cjs"] as const)
  test(`checks transitive module format ${file}`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    await writeFile(
      resolve(output, file),
      file.endsWith(".d.mts")
        ? 'export type T = import("dev-only").T;'
        : 'import "dev-only";',
    );
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/dependency is not declared|must emit ESM/),
    );
  });
