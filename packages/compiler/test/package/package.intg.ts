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
  assert.equal(typeof compiler.compileWorkflow, "function");
});

test("installs public Compiler/SDK archives and compiles a Workflow without Kernel or repository links", {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(resolve(tmpdir(), "intloom-author-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const project = resolve(temporary, "workflow");
  await cp(
    fileURLToPath(new URL("../fixtures/workflow/", import.meta.url)),
    project,
    { recursive: true },
  );
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const packages = await testArchives([
    "@intloom/compiler",
    "@intloom/workflow-sdk",
    "@intloom/utils",
  ]);
  const manifest = JSON.parse(
    await readFile(resolve(project, "package.json"), "utf8"),
  );
  manifest.dependencies["@intloom/workflow-sdk"] =
    `file:${packages["@intloom/workflow-sdk"]}`;
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
    'import type { Blueprint, ExecutableCode } from "@intloom/workflow-sdk"; export const code: ExecutableCode = () => ({ outcome: "done" }); export type Contract = Blueprint;',
  );
  await run(
    "npm",
    [
      "install",
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
  await writeFile(
    resolve(project, "build.mjs"),
    'import assert from "node:assert/strict"; import { compileWorkflow } from "@intloom/compiler"; await assert.rejects(import("@intloom/kernel"), { code: "ERR_MODULE_NOT_FOUND" }); await compileWorkflow({ packageRoot: process.cwd() }); const output = await import("./dist/workflow.generated.js"); assert.equal(typeof output.blueprint.flowName, "string"); assert.equal(typeof Object.values(output.codes)[0], "function");',
  );
  await run(process.execPath, [resolve(project, "build.mjs")], {
    cwd: project,
    maxBuffer: 1024 * 1024,
  });
  assert.match(
    await readFile(resolve(project, "dist/codes/sdk-contract.d.ts"), "utf8"),
    /@intloom\/workflow-sdk/u,
  );
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
