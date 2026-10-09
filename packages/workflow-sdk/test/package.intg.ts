import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  getAgentExecutionAccess,
  userAnswerConfirmationSchema,
  workflowProtocolVersion,
  defineAgentTool,
} from "@intloom/workflow-sdk";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const tsc = resolve(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);

test("loads the built SDK without a Kernel, Agent framework, or database dependency", async () => {
  assert.equal(typeof getAgentExecutionAccess, "function");
  assert.equal(typeof defineAgentTool, "function");
  assert.equal(
    import.meta.resolve("@intloom/workflow-sdk"),
    new URL("../dist/index.js", import.meta.url).href,
  );
  assert.equal(
    userAnswerConfirmationSchema.parse({ isConfirmed: false }).isConfirmed,
    false,
  );
  assert.equal(workflowProtocolVersion, "2026-10-08");
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    "@intloom/utils",
    "zod",
  ]);
  const files = await readdir(new URL("dist", root), { recursive: true });
  for (const file of files) {
    assert.equal(/\.(spec|intg)\.|^test\//u.test(file), false);
    if (file.endsWith(".js") || file.endsWith(".d.ts"))
      assert.doesNotMatch(
        await readFile(new URL(`dist/${file}`, root), "utf8"),
        /@intloom\/kernel|@mastra\/|better-sqlite3|drizzle-orm/u,
      );
  }
});

test("checks public declarations without source path mappings", async () => {
  await run(process.execPath, [
    tsc,
    "--project",
    resolve(root, "test/fixtures/consumer/tsconfig.json"),
    "--pretty",
    "false",
  ]);
});

test("installs SDK archives and checks runtime and declarations without repository links", {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(resolve(tmpdir(), "intloom-sdk-consumer-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const archives = resolve(temporary, "archives");
  const consumer = resolve(temporary, "consumer");
  await mkdir(archives);
  await cp(resolve(root, "test/fixtures/consumer"), consumer, {
    recursive: true,
  });
  const packages: Record<string, string> = {};
  for (const [name, directory] of [
    ["@intloom/workflow-sdk", root],
    ["@intloom/utils", resolve(root, "../utils")],
  ] as const) {
    const { stdout } = await run(
      "bun",
      ["pm", "pack", "--destination", archives, "--ignore-scripts", "--quiet"],
      { cwd: directory },
    );
    packages[name] = resolve(archives, stdout.trim());
  }
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  await writeFile(
    resolve(consumer, "package.json"),
    JSON.stringify({
      name: "intloom-sdk-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@intloom/workflow-sdk": `file:${packages["@intloom/workflow-sdk"]}`,
        "@intloom/utils": `file:${packages["@intloom/utils"]}`,
        zod: manifest.dependencies.zod,
      },
      devDependencies: { "@types/node": "^22" },
    }),
  );
  const base = JSON.parse(
    await readFile(resolve(root, "../../tsconfig.base.json"), "utf8"),
  );
  const config = JSON.parse(
    await readFile(resolve(consumer, "tsconfig.json"), "utf8"),
  );
  delete config.extends;
  config.compilerOptions = {
    ...base.compilerOptions,
    ...config.compilerOptions,
  };
  await writeFile(resolve(consumer, "tsconfig.json"), JSON.stringify(config));
  await run(
    "npm",
    [
      "install",
      "--engine-strict",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--fetch-retries=0",
      "--fetch-timeout=30000",
    ],
    {
      cwd: consumer,
      timeout: 90_000,
      maxBuffer: 1024 * 1024,
    },
  );
  await run(process.execPath, [
    tsc,
    "--project",
    resolve(consumer, "tsconfig.json"),
    "--pretty",
    "false",
  ]);
  await run(process.execPath, [resolve(consumer, "runtime.ts")], {
    cwd: consumer,
  });
  const files = await readdir(
    resolve(consumer, "node_modules/@intloom/workflow-sdk"),
    { recursive: true },
  );
  for (const file of files)
    assert.equal(/^src\/|^test\/|\.(spec|intg)\./u.test(file), false);
});
