import assert from "node:assert/strict";
import { test } from "node:test";
import { artifacts, invalidOutput } from "../../test/helpers/artifacts.ts";
import { verifyArtifacts } from "./verify-artifacts.ts";
import fs, { rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";
import { LoomError } from "@intloom/utils";
import type { LinkedLoom } from "../analyze/model.ts";

test("reads shared modules once per verification and refreshes them on the next call", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  const run = loom.model.codes.run;
  assert.ok(run);
  const sourceFile = run.module.sourceFile;
  const linked: LinkedLoom = {
    ...loom,
    model: {
      ...loom.model,
      codes: {
        ...loom.model.codes,
        second: {
          ...run,
          resourceKey: "second",
          module: { sourceFile, exportName: "second" },
        },
      },
    },
  };
  await writeFile(
    codeFile,
    "export default function run() {} export function second() {}",
  );
  const read = fs.readFile;
  const reads = new Map<unknown, number>();
  t.mock.method(
    fs,
    "readFile",
    async (...args: Parameters<typeof fs.readFile>) => {
      const file = args[0];
      reads.set(file, (reads.get(file) ?? 0) + 1);
      return read(...args);
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  await verifyArtifacts(root, output, linked);
  assert.equal(reads.get(codeFile), 1);
  assert.equal(reads.get(resolve(output, "loom.generated.js")), 1);
  await writeFile(codeFile, "export default function run() {}");
  await assert.rejects(verifyArtifacts(root, output, linked), (error) => {
    invalidOutput(/No runtime export second/u)(error);
    assert.ok(LoomError.is(error));
    assert.equal(
      (error.cause as { location: { file: string } }).location.file,
      sourceFile,
    );
    return true;
  });
  assert.equal(reads.get(codeFile), 2);
});

test("checks forwarded exports independently when their module is cached", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  const run = loom.model.codes.run;
  assert.ok(run);
  const sourceFile = run.module.sourceFile;
  const linked: LinkedLoom = {
    ...loom,
    model: {
      ...loom.model,
      codes: {
        ...loom.model.codes,
        second: {
          ...run,
          resourceKey: "second",
          module: { sourceFile, exportName: "second" },
        },
      },
    },
  };
  await writeFile(
    codeFile,
    'export default function run() {} export { second } from "./other.js";',
  );
  await assert.rejects(verifyArtifacts(root, output, linked), (error) => {
    invalidOutput(/Missing referenced JavaScript module/u)(error);
    assert.ok(LoomError.is(error));
    assert.equal(
      (error.cause as { location: { file: string } }).location.file,
      resolve(output, "codes/other.js"),
    );
    return true;
  });
});

for (const [label, source, message] of [
  ["type-only output", "export {};", /No runtime export default/],
  ["unbound default", "export default missing;", /no runtime binding/],
  [
    "re-export entry",
    'export { default } from "./implementation.js";',
    /Missing referenced JavaScript module/,
  ],
  ["invalid JavaScript", "export default (", /Invalid emitted ESM/],
] satisfies [string, string, RegExp][]) {
  test(`rejects referenced ${label}`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(codeFile, source);
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(message),
    );
  });
}

test("rejects a missing referenced resource module", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  await rm(codeFile);
  await assert.rejects(
    verifyArtifacts(root, output, loom),
    invalidOutput(/Missing referenced JavaScript module/),
  );
});

for (const kind of ["state", "agent output", "tool"] as const) {
  test(`checks ${kind} module exports as well as Code exports`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    const reference = {
      sourceFile: resolve(root, "resource.ts"),
      exportName: "resource",
    };
    const location = { file: reference.sourceFile };
    const model: LinkedLoom["model"] = {
      ...loom.model,
      stages:
        kind === "state"
          ? {
              main: {
                stageName: "main",
                location,
                stateSchema: reference,
                initializeState: reference,
                entryStepName: "run",
                steps: {},
                on: {},
              },
            }
          : {},
      agents:
        kind !== "state"
          ? {
              a: {
                resourceKey: "a",
                location,
                name: "a",
                description: "",
                instructions: "",
                llm: "thinking",
                outputSchema:
                  kind === "agent output"
                    ? reference
                    : {
                        sourceFile: resolve(root, "codes/run.ts"),
                        exportName: "default",
                      },
                skills: [],
                tools: kind === "tool" ? [reference] : [],
              },
            }
          : {},
    };
    const linked = { ...loom, model };
    await writeFile(
      resolve(output, "resource.js"),
      "export const resource = {}; ",
    );
    await verifyArtifacts(root, output, linked);
    await writeFile(resolve(output, "resource.js"), "export {}; ");
    await assert.rejects(
      verifyArtifacts(root, output, linked),
      invalidOutput(/No runtime export resource/),
    );
  });
}

for (const style of [
  "named",
  "star",
  "import_alias",
  "cycle",
  "diamond",
  "shadow",
] as const) {
  test(`resolves ${style} re-export chains without executing their modules`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(
      resolve(output, "codes/leaf.js"),
      'throw new Error("never execute"); export function run() {}',
    );
    await writeFile(
      resolve(output, "codes/a.js"),
      'export * from "./leaf.js";',
    );
    await writeFile(
      resolve(output, "codes/b.js"),
      style === "cycle"
        ? 'export * from "./a.js";'
        : 'export { run } from "./leaf.js";',
    );
    if (style === "cycle")
      await writeFile(
        resolve(output, "codes/a.js"),
        'export * from "./b.js"; export * from "./leaf.js";',
      );
    if (style === "shadow")
      await writeFile(
        resolve(output, "codes/b.js"),
        "export function run() {}",
      );
    const code =
      style === "import_alias"
        ? 'import { run } from "./a.js"; export default run;'
        : style === "diamond" || style === "shadow"
          ? 'export { run as default } from "./barrel.js";'
          : 'export { run as default } from "./a.js";';
    if (style === "named")
      await writeFile(
        resolve(output, "codes/a.js"),
        'export { run } from "./leaf.js";',
      );
    if (style === "diamond" || style === "shadow")
      await writeFile(
        resolve(output, "codes/barrel.js"),
        `export * from "./a.js"; export * from "./b.js"; ${style === "shadow" ? 'export { run } from "./leaf.js";' : ""}`,
      );
    await writeFile(codeFile, code);
    await verifyArtifacts(root, output, loom);
  });
}

for (const scenario of [
  "ambiguous",
  "unresolved_cycle",
  "star_default",
] as const) {
  test(`rejects ${scenario} re-export resolution`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(
      resolve(output, "codes/a.js"),
      scenario === "unresolved_cycle"
        ? 'export * from "./b.js";'
        : "export function run() {} export default run;",
    );
    await writeFile(
      resolve(output, "codes/b.js"),
      scenario === "unresolved_cycle"
        ? 'export * from "./a.js";'
        : "export function run() {}",
    );
    await writeFile(
      resolve(output, "codes/barrel.js"),
      'export * from "./a.js"; export * from "./b.js";',
    );
    await writeFile(
      codeFile,
      scenario === "star_default"
        ? 'export * from "./a.js";'
        : 'export { run as default } from "./barrel.js";',
    );
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Ambiguous|No runtime export/),
    );
  });
}

for (const shared of [true, false])
  test(`distinguishes default declarations from default value snapshots, shared=${shared}`, async (t) => {
    const { root, output, loom, codeFile } = await artifacts(t);
    await writeFile(
      resolve(output, "codes/leaf.js"),
      shared
        ? "export default function run() {} export { run };"
        : "export function run() {} export default run;",
    );
    await writeFile(
      resolve(output, "codes/a.js"),
      'export { default as run } from "./leaf.js";',
    );
    await writeFile(
      resolve(output, "codes/b.js"),
      'export { run } from "./leaf.js";',
    );
    await writeFile(
      resolve(output, "codes/barrel.js"),
      'export * from "./a.js"; export * from "./b.js";',
    );
    await writeFile(codeFile, 'export { run as default } from "./barrel.js";');
    if (shared) await verifyArtifacts(root, output, loom);
    else
      await assert.rejects(
        verifyArtifacts(root, output, loom),
        invalidOutput(/Ambiguous/),
      );
  });

test("rejects erased imported bindings even behind a local value alias", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  await writeFile(resolve(output, "codes/leaf.js"), "export {};");
  await writeFile(
    codeFile,
    'import { run } from "./leaf.js"; const local = run; export default local;',
  );
  await assert.rejects(
    verifyArtifacts(root, output, loom),
    invalidOutput(/Missing or ambiguous runtime import/),
  );
});
