import assert from "node:assert/strict";
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path, { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { LoomError } from "@intloom/utils";
import type { LinkedWorkflow } from "../analyze/model.ts";
import { listOutputFiles } from "./output-files.ts";
import { verifyArtifacts } from "./verify-artifacts.ts";

async function artifacts(t: TestContext) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-artifacts-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = resolve(root, "dist");
  await mkdir(resolve(output, "codes"), { recursive: true });
  const manifest = {
    exports: {
      ".": {
        types: "./dist/workflow.generated.d.ts",
        default: "./dist/workflow.generated.js",
      } as Record<string, string>,
    },
    files: ["dist"],
    dependencies: {} as Record<string, string>,
    peerDependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
  };
  await writeFile(resolve(root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    resolve(output, "workflow.generated.js"),
    'import run from "./codes/run.js";\nexport const blueprint = {};\nexport const codes = { "CODE-fixed": run };\nexport const agentSpecs = {};\n',
  );
  await writeFile(
    resolve(output, "workflow.generated.d.ts"),
    "export declare const blueprint: {}; export declare const codes: {}; export declare const agentSpecs: {};",
  );
  await writeFile(resolve(output, "workflow.generated.js.map"), "{}");
  const codeFile = resolve(output, "codes/run.js");
  await writeFile(
    codeFile,
    'export default function run() { return { outcome: "complete" }; }',
  );
  const workflow: LinkedWorkflow = {
    model: {
      options: { packageRoot: root },
      flowName: "example",
      version: "1.0.0",
      entryStageName: "main",
      stages: {},
      codes: {
        run: {
          resourceKey: "run",
          location: { file: resolve(root, "workflow.yaml") },
          module: {
            sourceFile: resolve(root, "codes/run.ts"),
            exportName: "default",
          },
        },
      },
      agents: {},
      assets: [],
    },
    codeIds: { run: "CODE-fixed" },
    agentIds: {},
  };
  return { root, output, manifest, workflow, codeFile };
}

function invalidOutput(message: RegExp) {
  return (error: unknown) => {
    assert.ok(LoomError.is(error));
    assert.equal(error.code, "INVALID_OUTPUT");
    assert.match(error.message, message);
    return true;
  };
}

test("reads shared modules once per verification and refreshes them on the next call", async (t) => {
  const { root, output, workflow, codeFile } = await artifacts(t);
  const run = workflow.model.codes.run;
  assert.ok(run);
  const sourceFile = run.module.sourceFile;
  const linked: LinkedWorkflow = {
    ...workflow,
    model: {
      ...workflow.model,
      codes: {
        ...workflow.model.codes,
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
  assert.equal(reads.get(resolve(output, "workflow.generated.js")), 1);
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
  const { root, output, workflow, codeFile } = await artifacts(t);
  const run = workflow.model.codes.run;
  assert.ok(run);
  const sourceFile = run.module.sourceFile;
  const linked: LinkedWorkflow = {
    ...workflow,
    model: {
      ...workflow.model,
      codes: {
        ...workflow.model.codes,
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
    invalidOutput(/defining module/u)(error);
    assert.ok(LoomError.is(error));
    assert.equal(
      (error.cause as { location: { file: string } }).location.file,
      sourceFile,
    );
    return true;
  });
});

test("uses Windows separators when excluding test directories", async (t) => {
  const { root, output, workflow } = await artifacts(t);
  const file = resolve(output, "test/helper.d.ts");
  await mkdir(resolve(output, "test"));
  await writeFile(file, "export {};");
  const descriptor = Object.getOwnPropertyDescriptor(path, "sep");
  assert.ok(descriptor);
  const nativeRelative = path.relative;
  const nativeSeparator = path.sep;
  t.mock.method(path, "relative", (from: string, to: string) => {
    const relative = nativeRelative(from, to);
    return from === output
      ? relative.replaceAll(nativeSeparator, "\\")
      : relative;
  });
  Object.defineProperty(path, "sep", { ...descriptor, value: "\\" });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    Object.defineProperty(path, "sep", descriptor);
    syncBuiltinESMExports();
  });
  await assert.rejects(verifyArtifacts(root, output, workflow), (error) => {
    invalidOutput(/Tests must not enter output/u)(error);
    assert.ok(LoomError.is(error));
    assert.equal(
      (error.cause as { location: { file: string } }).location.file,
      file,
    );
    return true;
  });
});

test("accepts a complete output tree without importing or executing modules", async (t) => {
  const { root, output, workflow, codeFile } = await artifacts(t);
  await writeFile(
    codeFile,
    'throw new Error("must not execute"); export default function run() {}',
  );
  assert.equal(await verifyArtifacts(root, output, workflow), undefined);
  assert.deepEqual(
    (await listOutputFiles(output))
      .map((file) => file.slice(output.length + 1))
      .sort(),
    [
      "codes/run.js",
      "workflow.generated.d.ts",
      "workflow.generated.js",
      "workflow.generated.js.map",
    ],
  );
});

for (const [label, change, message] of [
  [
    "missing entry",
    (x) => {
      x.exports["."] = {};
    },
    /exports/,
  ],
  [
    "wrong JS entry",
    (x) => {
      x.exports["."].default = "./dist/index.js";
    },
    /exports/,
  ],
  [
    "wrong declaration entry",
    (x) => {
      x.exports["."].types = "./src/index.ts";
    },
    /exports/,
  ],
  [
    "unsupported condition",
    (x) => {
      x.exports["."].require = "./dist/index.cjs";
    },
    /Unsupported package entry/,
  ],
  [
    "inconsistent import condition",
    (x) => {
      x.exports["."].import = "./dist/other.js";
    },
    /Unsupported package entry/,
  ],
  [
    "missing dist in files",
    (x) => {
      x.files = ["src"];
    },
    /files must include dist/,
  ],
] satisfies [
  string,
  (x: Awaited<ReturnType<typeof artifacts>>["manifest"]) => void,
  RegExp,
][]) {
  test(`rejects package metadata with ${label}`, async (t) => {
    const x = await artifacts(t);
    change(x.manifest);
    await writeFile(
      resolve(x.root, "package.json"),
      JSON.stringify(x.manifest),
    );
    await assert.rejects(
      verifyArtifacts(x.root, x.output, x.workflow),
      invalidOutput(message),
    );
  });
}

test("accepts an import condition pointing to the same generated entry", async (t) => {
  const x = await artifacts(t);
  x.manifest.exports["."].import = "./dist/workflow.generated.js";
  await writeFile(resolve(x.root, "package.json"), JSON.stringify(x.manifest));
  await verifyArtifacts(x.root, x.output, x.workflow);
});

for (const suffix of [".js", ".d.ts", ".js.map"]) {
  test(`rejects a missing entry ${suffix}`, async (t) => {
    const { root, output, workflow } = await artifacts(t);
    await rm(resolve(output, `workflow.generated${suffix}`));
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(/Missing entry artifact/),
    );
  });
}

for (const name of ["blueprint", "codes", "agentSpecs"]) {
  test(`rejects a missing ${name} named export`, async (t) => {
    const { root, output, workflow } = await artifacts(t);
    const entry = resolve(output, "workflow.generated.js");
    await writeFile(
      entry,
      (await readFile(entry, "utf8")).replace(
        `export const ${name}`,
        `const ${name}`,
      ),
    );
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(new RegExp(`Missing named export: ${name}`)),
    );
  });
}

for (const [label, source, message] of [
  ["type-only output", "export {};", /No runtime export default/],
  ["unbound default", "export default missing;", /no runtime binding/],
  [
    "re-export entry",
    'export { default } from "./implementation.js";',
    /defining module/,
  ],
  ["invalid JavaScript", "export default (", /Invalid emitted ESM/],
] satisfies [string, string, RegExp][]) {
  test(`rejects referenced ${label}`, async (t) => {
    const { root, output, workflow, codeFile } = await artifacts(t);
    await writeFile(codeFile, source);
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(message),
    );
  });
}

test("rejects a missing referenced resource module", async (t) => {
  const { root, output, workflow, codeFile } = await artifacts(t);
  await rm(codeFile);
  await assert.rejects(
    verifyArtifacts(root, output, workflow),
    invalidOutput(/Missing referenced JavaScript module/),
  );
});

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
    const { root, output, workflow, codeFile } = await artifacts(t);
    await writeFile(codeFile, `${statement}\nexport default function run() {}`);
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(message),
    );
  });
}

test("accepts relative literal dynamic imports and Node builtins", async (t) => {
  const { root, output, workflow, codeFile } = await artifacts(t);
  await writeFile(
    resolve(output, "codes/helper.js"),
    "export const value = 1;",
  );
  await writeFile(
    codeFile,
    'import "node:fs"; import "path"; export default async function run() { return import("./helper.js"); }',
  );
  await verifyArtifacts(root, output, workflow);
});

for (const field of [
  "dependencies",
  "peerDependencies",
  "devDependencies",
] as const) {
  test(`checks external scoped subpath imports against ${field}`, async (t) => {
    const { root, output, workflow, codeFile, manifest } = await artifacts(t);
    manifest[field]["@example/tool"] = "1.0.0";
    await writeFile(resolve(root, "package.json"), JSON.stringify(manifest));
    await writeFile(
      codeFile,
      'import "@example/tool/subpath"; export default function run() {}',
    );
    if (field === "devDependencies")
      await assert.rejects(
        verifyArtifacts(root, output, workflow),
        invalidOutput(/Runtime dependency is not declared/),
      );
    else await verifyArtifacts(root, output, workflow);
  });
}

for (const specifier of ["undeclared", "toString"]) {
  test(`rejects undeclared dependency ${specifier}`, async (t) => {
    const { root, output, workflow, codeFile } = await artifacts(t);
    await writeFile(
      codeFile,
      `import ${JSON.stringify(specifier)}; export default function run() {}`,
    );
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(/Runtime dependency is not declared/),
    );
  });
}

for (const name of ["check.spec.js", "check.intg.d.ts", "test/helper.js"]) {
  test(`rejects test artifact ${name}`, async (t) => {
    const { root, output, workflow } = await artifacts(t);
    await mkdir(resolve(output, "test"), { recursive: true });
    await writeFile(resolve(output, name), "");
    await assert.rejects(
      verifyArtifacts(root, output, workflow),
      invalidOutput(/Tests must not enter output/),
    );
  });
}

test("rejects output symlinks", async (t) => {
  const { root, output, workflow, codeFile } = await artifacts(t);
  await symlink(codeFile, resolve(output, "linked.js"));
  await assert.rejects(
    verifyArtifacts(root, output, workflow),
    invalidOutput(/must not contain symlinks/),
  );
});

for (const kind of ["state", "agent output", "tool"] as const) {
  test(`checks ${kind} module exports as well as Code exports`, async (t) => {
    const { root, output, workflow } = await artifacts(t);
    const reference = {
      sourceFile: resolve(root, "resource.ts"),
      exportName: "resource",
    };
    const location = { file: reference.sourceFile };
    const model: LinkedWorkflow["model"] = {
      ...workflow.model,
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
                llm: "reasoning",
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
    const linked = { ...workflow, model };
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
