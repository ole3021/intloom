import { testArchives } from "../../../../scripts/test-packages.ts";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

test("loads the compiler through the built package entry", async () => {
  assert.equal(
    import.meta.resolve("@intloom/compiler"),
    new URL("../../dist/index.js", import.meta.url).href,
  );
  const compiler = await import("@intloom/compiler");
  assert.equal(typeof compiler.compileLoom, "function");
});

test("installs public Compiler/SDK archives and compiles a Loom without Kernel or repository links", {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(resolve(tmpdir(), "intloom-author-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const project = resolve(temporary, "loom");
  await cp(
    fileURLToPath(new URL("../fixtures/loom/", import.meta.url)),
    project,
    { recursive: true },
  );
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const packages = await testArchives([
    "@intloom/compiler",
    "@intloom/loom-sdk",
    "@intloom/utils",
  ]);
  const manifest = JSON.parse(
    await readFile(resolve(project, "package.json"), "utf8"),
  );
  manifest.dependencies["@intloom/loom-sdk"] =
    `file:${packages["@intloom/loom-sdk"]}`;
  manifest.devDependencies = {
    "@intloom/compiler": `file:${packages["@intloom/compiler"]}`,
    "@types/node": "^26",
  };
  manifest.overrides = Object.fromEntries(
    Object.entries(packages).map(([name, file]) => [name, `file:${file}`]),
  );
  await writeFile(resolve(project, "package.json"), JSON.stringify(manifest));
  const base = JSON.parse(
    await readFile(resolve(repository, "tsconfig.base.json"), "utf8"),
  );
  const config = JSON.parse(
    await readFile(resolve(project, "tsconfig.build.json"), "utf8"),
  );
  delete config.extends;
  config.compilerOptions = {
    ...base.compilerOptions,
    ...config.compilerOptions,
  };
  await writeFile(
    resolve(project, "tsconfig.build.json"),
    JSON.stringify(config),
  );
  await writeFile(
    resolve(project, "codes/sdk-contract.ts"),
    'import type { Blueprint, ExecutableCode } from "@intloom/loom-sdk"; export const code: ExecutableCode = () => ({ outcome: "done" }); export type Contract = Blueprint;',
  );
  await writeFile(
    resolve(project, "codes/run.ts"),
    (await readFile(resolve(project, "codes/run.ts"), "utf8")) +
      '\nexport { code } from "./sdk-contract.ts";\n',
  );
  await run(
    "npm",
    [
      "install",
      "--cache",
      resolve(temporary, "npm-cache"),
      "--engine-strict",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: project,
      timeout: 90_000,
    },
  );
  // Local archives install the authoring toolchain; the emitted package records publishable ranges.
  manifest.dependencies["@intloom/loom-sdk"] = JSON.parse(
    await readFile(
      resolve(project, "node_modules/@intloom/loom-sdk/package.json"),
      "utf8",
    ),
  ).version;
  await writeFile(resolve(project, "package.json"), JSON.stringify(manifest));
  await writeFile(
    resolve(project, "build.mjs"),
    'import assert from "node:assert/strict"; import { compileLoom } from "@intloom/compiler"; await assert.rejects(import("@intloom/kernel"), { code: "ERR_MODULE_NOT_FOUND" }); await compileLoom({ packageRoot: process.cwd() }); const output = await import("./dist/loom.generated.js"); assert.equal(typeof output.blueprint.loomName, "string"); assert.equal(typeof Object.values(output.codes)[0], "function");',
  );
  await run(process.execPath, [resolve(project, "build.mjs")], {
    cwd: project,
    maxBuffer: 1024 * 1024,
  });
  assert.match(
    await readFile(resolve(project, "dist/codes/sdk-contract.d.ts"), "utf8"),
    /@intloom\/loom-sdk/u,
  );
  await writeFile(
    resolve(project, "capability.mjs"),
    `import assert from "node:assert/strict";
import { scaffoldLoom, checkLoom, inspectLoom, compileLoom } from "@intloom/compiler";
import { validateCompiledLoom } from "@intloom/loom-sdk/compiled";
await scaffoldLoom("./new-capability");
await checkLoom({ packageRoot: "./new-capability" });
const inspected = await inspectLoom("./new-capability");
assert.equal(inspected.definition.name, "new-capability");
await compileLoom({ packageRoot: "./new-capability" });
const { definition, plan, bindings } = await import("./new-capability/dist/loom.generated.js");
validateCompiledLoom({ definition, plan, bindings });
assert.equal(definition.input.type, "string");
assert.equal(plan.steps.at(-1).kind, "deliver");
assert.equal(Object.values(bindings.codes)[0]("  archive consumer  "), "archive consumer");
`,
  );
  await run(process.execPath, [resolve(project, "capability.mjs")], {
    cwd: project,
    maxBuffer: 1024 * 1024,
  });
});

test("resolves compiler declarations without source path mappings", async () => {
  const require = createRequire(import.meta.url);
  const tsc = resolve(
    dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  await run(process.execPath, [
    tsc,
    "--project",
    fileURLToPath(
      new URL("../fixtures/consumer/tsconfig.json", import.meta.url),
    ),
    "--pretty",
    "false",
  ]);
});
