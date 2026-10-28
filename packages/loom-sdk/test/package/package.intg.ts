import { testArchives } from "../../../../scripts/test-packages.ts";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
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
  userAnswerConfirmationSchema,
  loomProtocolVersion,
  defineAgentTool,
} from "@intloom/loom-sdk";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const tsc = resolve(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);

test("loads the built SDK without a Kernel, Agent framework, or database dependency", async () => {
  assert.equal(typeof defineAgentTool, "function");
  assert.equal(
    import.meta.resolve("@intloom/loom-sdk"),
    new URL("../../dist/index.js", import.meta.url).href,
  );
  assert.equal(
    userAnswerConfirmationSchema.parse({ isConfirmed: false }).isConfirmed,
    false,
  );
  assert.equal(loomProtocolVersion, "2026-10-15");
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["zod"]);
  const files = await readdir(new URL("dist", root), { recursive: true });
  for (const file of files) {
    assert.equal(/\.(spec|intg)\.|^test\//u.test(file), false);
    if (file.endsWith(".js") || file.endsWith(".d.ts"))
      assert.doesNotMatch(
        await readFile(new URL(`dist/${file}`, root), "utf8"),
        /@intloom\/(?:kernel|utils)|@mastra\/|better-sqlite3|drizzle-orm/u,
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
  const consumer = resolve(temporary, "consumer");
  await cp(resolve(root, "test/fixtures/consumer"), consumer, {
    recursive: true,
  });
  const packages = await testArchives(["@intloom/loom-sdk"]);
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
        "@intloom/loom-sdk": `file:${packages["@intloom/loom-sdk"]}`,
        zod: manifest.dependencies.zod,
      },
      devDependencies: { "@types/node": "^26" },
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
      "--cache",
      resolve(temporary, "npm-cache"),
      "--engine-strict",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--fetch-retries=2",
      "--fetch-retry-mintimeout=1000",
      "--fetch-retry-maxtimeout=3000",
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
    resolve(consumer, "node_modules/@intloom/loom-sdk"),
    { recursive: true },
  );
  for (const file of files)
    assert.equal(/^src\/|^test\/|\.(spec|intg)\./u.test(file), false);
  // The optional browser entry is independently consumable after installing its peers.
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...Object.entries(manifest.peerDependencies).map(
        ([name, version]) => `${name}@${version}`,
      ),
    ],
    { cwd: consumer, timeout: 90_000, maxBuffer: 1024 * 1024 },
  );
  await writeFile(
    resolve(consumer, "app.ts"),
    `
import { connectLoomApp, type AppSnapshot } from "@intloom/loom-sdk/app";
export async function attach() {
  const app = await connectLoomApp({name: "archive-consumer"});
  app.subscribe((snapshot: AppSnapshot) => { void snapshot.view.mode; });
  await app.dispose();
}
if (typeof connectLoomApp !== "function") throw new Error("Missing browser export");
`,
  );
  config.files = ["app.ts"];
  config.compilerOptions.lib = ["ES2024", "DOM", "DOM.Iterable"];
  await writeFile(resolve(consumer, "tsconfig.json"), JSON.stringify(config));
  await run(process.execPath, [
    tsc,
    "--project",
    resolve(consumer, "tsconfig.json"),
    "--pretty",
    "false",
  ]);
  await run(process.execPath, [resolve(consumer, "app.ts")], { cwd: consumer });
});
