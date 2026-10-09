import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
test("isolated tarball installation exposes the Node bin and public ESM entry without test sources", {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "intloom-cli-package-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const archives = join(temporary, "archives");
  const consumerRoot = join(temporary, "consumer");
  await mkdir(archives);
  await mkdir(consumerRoot);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const repositoryManifest = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const tsc = join(
    dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
    "bin/tsc",
  );
  const packages: Record<string, string> = {};
  for (const [name, directory] of [
    ["cli", "apps/cli/.publish"],
    ["intloom", "apps/cli/.publish-intloom"],
    ["workflow-sdk", "packages/workflow-sdk"],
    ["workflow-intent", "packages/intent/dist"],
    ["utils", "packages/utils"],
  ] as const) {
    const { stdout } = await run(
      "bun",
      ["pm", "pack", "--destination", archives, "--ignore-scripts", "--quiet"],
      { cwd: resolve(root, directory) },
    );
    packages[name === "intloom" ? name : `@intloom/${name}`] = resolve(
      archives,
      stdout.trim(),
    );
  }
  function archiveFor(name: string): string {
    const archive = packages[name];
    assert.ok(archive, `Missing archive for ${name}`);
    return archive;
  }
  for (const launcher of ["@intloom/cli", "intloom"])
    await t.test(launcher, async () => {
      const project = join(
        consumerRoot,
        launcher === "intloom" ? "launcher" : "scoped",
      );
      await mkdir(project);
      await writeFile(
        join(project, "package.json"),
        JSON.stringify({
          type: "module",
          dependencies: {
            [launcher]: `file:${archiveFor(launcher)}`,
            "@intloom/workflow-intent": `file:${archiveFor("@intloom/workflow-intent")}`,
          },
          devDependencies: {
            "@types/node": repositoryManifest.devDependencies["@types/node"],
          },
          overrides: Object.fromEntries(
            Object.entries(packages).map(([name, file]) => [
              name,
              `file:${file}`,
            ]),
          ),
        }),
      );
      await run(
        "npm",
        ["install", "--engine-strict", "--no-audit", "--no-fund"],
        {
          cwd: project,
          timeout: 90_000,
          maxBuffer: 1024 * 1024,
        },
      );
      if (launcher === "intloom") {
        const entry = JSON.parse(
          await readFile(
            join(project, "node_modules/intloom/package.json"),
            "utf8",
          ),
        );
        const cli = JSON.parse(
          await readFile(join(root, "apps/cli/package.json"), "utf8"),
        );
        assert.deepEqual(entry.dependencies, { "@intloom/cli": cli.version });
        assert.deepEqual(entry.bin, { intloom: "./dist/bin.js" });
        assert.equal(entry.engines.node, ">=22.22.0");
        assert.equal(entry.bundleDependencies, undefined);
        assert.match(
          await readFile(
            join(project, "node_modules/intloom/dist/bin.js"),
            "utf8",
          ),
          /import "@intloom\/cli\/bin"/,
        );
      }
      const installed = join(project, "node_modules/@intloom/cli");
      const files = await readdir(installed, { recursive: true });
      assert.ok(files.includes("dist/bin.js"));
      assert.ok(files.includes("dist/index.d.ts"));
      assert.ok(files.includes("README.md"));
      assert.ok(files.includes("LICENSE"));
      assert.ok(files.includes("node_modules/@intloom/kernel/dist/index.js"));
      assert.ok(
        files.includes(
          "node_modules/@intloom/kernel/migrations/storage-sqlite/meta/_journal.json",
        ),
      );
      const embeddedKernel = JSON.parse(
        await readFile(
          join(installed, "node_modules/@intloom/kernel/package.json"),
          "utf8",
        ),
      );
      assert.equal(embeddedKernel.private, true);
      assert.equal(embeddedKernel.engines.node, ">=22.22.0");
      assert.equal(embeddedKernel.dependencies, undefined);
      assert.equal(
        files.some((file) =>
          /(?:\.spec\.|\.intg\.|^test\/|^src\/)/u.test(file),
        ),
        false,
      );
      const manifest = JSON.parse(
        await readFile(join(installed, "package.json"), "utf8"),
      );
      assert.equal(manifest.engines.node, ">=22.22.0");
      const kernelManifest = JSON.parse(
        await readFile(resolve(root, "packages/kernel/package.json"), "utf8"),
      );
      const utilsManifest = JSON.parse(
        await readFile(resolve(root, "packages/utils/package.json"), "utf8"),
      );
      const workflowSdkManifest = JSON.parse(
        await readFile(
          resolve(root, "packages/workflow-sdk/package.json"),
          "utf8",
        ),
      );
      assert.equal(
        manifest.dependencies["@intloom/kernel"],
        kernelManifest.version,
      );
      assert.equal(
        manifest.dependencies["@intloom/utils"],
        utilsManifest.version,
      );
      assert.equal(
        manifest.dependencies["@intloom/workflow-sdk"],
        workflowSdkManifest.version,
      );
      assert.deepEqual(manifest.bundleDependencies, ["@intloom/kernel"]);
      assert.match(
        await readFile(join(installed, "dist/bin.js"), "utf8"),
        /^#!\/usr\/bin\/env node/u,
      );
      const result = await run(
        process.execPath,
        [join(project, "node_modules/.bin/intloom"), "--help", "--no-color"],
        { cwd: project },
      );
      assert.match(result.stdout, /flow \[options\]/u);
      assert.equal(result.stdout.includes(String.fromCharCode(27)), false);
      const version = await run(
        process.execPath,
        [join(project, "node_modules/.bin/intloom"), "--version"],
        { cwd: project },
      );
      assert.equal(version.stdout.trim(), manifest.version);
      const initialized = await run(
        process.execPath,
        [
          join(project, "node_modules/.bin/intloom"),
          "init",
          `../new-project-${launcher === "intloom" ? "launcher" : "scoped"}`,
          "--json",
          "--no-interactive",
        ],
        { cwd: project },
      );
      const scaffold = JSON.parse(initialized.stdout);
      assert.equal(scaffold.status, "scaffolded");
      assert.ok(
        (
          await readFile(join(scaffold.projectRoot, "intloom.yaml"), "utf8")
        ).includes("workflows: []"),
      );
      assert.equal(
        (await readdir(scaffold.projectRoot)).includes("package.json"),
        false,
      );
      const consumer = join(project, "consumer.mjs");
      await writeFile(
        consumer,
        `
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { workflowProtocolVersion } from "@intloom/workflow-sdk";
import { blueprint } from "@intloom/workflow-intent";
import { runCli, startService, stopService, startProjectHost, connectProject, connectProjectClient, discoverProjectConnection, addWorkflow, removeWorkflow, listInstalledWorkflows, doctorProject } from "@intloom/cli";
for (const item of [runCli, startService, startProjectHost, connectProject, connectProjectClient, discoverProjectConnection, addWorkflow, removeWorkflow, listInstalledWorkflows, doctorProject]) assert.equal(typeof item, "function");
await assert.rejects(import("@intloom/kernel"), { code: "ERR_MODULE_NOT_FOUND" });
assert.equal(blueprint.flowName, "intent");
assert.equal(createRequire(import.meta.url)("@intloom/workflow-intent/package.json").intloom.version, workflowProtocolVersion);
const require = createRequire(import.meta.resolve("@intloom/cli"));
for (const backend of ["file", "sqlite"]) {
  const projectRoot = process.argv[2] + "-" + backend;
  assert.equal(await runCli(["init", projectRoot, "--json", "--no-interactive"]), 0);
  const storage = await import(pathToFileURL(require.resolve("@intloom/kernel/storage/" + backend)).href);
  const options = backend === "file" ? { directory: resolve("file-store") } : { filename: resolve("store.sqlite"), projectId: "consumer" };
  const open = backend === "file" ? storage.openFileStorage : storage.openSqliteStorage;
  const handle = await open(options);
  try {
    await handle.access.commit([{ type: "append_record", id: "consumer", payload: { flowName: "fixture", stageName: "first", data: "persisted" } }]);
  } finally {
    await handle.dispose();
  }
  const reopened = await open(options);
  try {
    assert.equal((await reopened.access.getRecordById("consumer")).data, "persisted");
  } finally {
    await reopened.dispose();
  }
  await writeFile(resolve(projectRoot, "intloom.yaml"), "localStorage: " + backend + "\\nworkflows: []\\nintent: { apps: [] }\\n");
  await startService({ projectRoot });
  try {
    const client = await connectProject(projectRoot);
    try {
      assert.deepEqual(await client.listRuns(), []);
    } finally {
      await client.close();
    }
  } finally {
    await stopService(projectRoot);
  }
}
`,
      );
      await run(process.execPath, [consumer, scaffold.projectRoot], {
        cwd: project,
        timeout: 30_000,
      });
      const types = join(project, "consumer.ts");
      await writeFile(
        types,
        'import { connectProject } from "@intloom/cli"; export type Client = Awaited<ReturnType<typeof connectProject>>;',
      );
      await run(
        process.execPath,
        [
          tsc,
          "--noEmit",
          "--strict",
          "--skipLibCheck",
          "--target",
          "ES2023",
          "--module",
          "NodeNext",
          "--types",
          "node",
          types,
        ],
        { cwd: project },
      );
      const listed = await run(
        process.execPath,
        [
          join(project, "node_modules/.bin/intloom"),
          "--project",
          scaffold.projectRoot,
          "workflow",
          "list",
          "--json",
        ],
        { cwd: project },
      );
      assert.deepEqual(JSON.parse(listed.stdout).workflows, []);
      const doctor = await run(
        process.execPath,
        [
          join(project, "node_modules/.bin/intloom"),
          "--project",
          scaffold.projectRoot,
          "doctor",
          "--execution",
          "cli",
          "--json",
        ],
        { cwd: project },
      );
      assert.equal(
        JSON.parse(doctor.stdout).checks.find(
          (item: { name: string }) => item.name === "execution",
        ).status,
        "attention",
      );
      const prefix = join(project, "global");
      await run(
        "npm",
        [
          "install",
          "--global",
          "--prefix",
          prefix,
          "--engine-strict",
          "--no-audit",
          "--no-fund",
          archiveFor(launcher),
          archiveFor("@intloom/cli"),
          archiveFor("@intloom/utils"),
          archiveFor("@intloom/workflow-sdk"),
        ],
        { cwd: project, timeout: 90_000, maxBuffer: 1024 * 1024 },
      );
      const bin =
        process.platform === "win32"
          ? join(prefix, "intloom.cmd")
          : join(prefix, "bin/intloom");
      const globalVersion = await run(bin, ["--version"], { cwd: project });
      assert.equal(globalVersion.stdout.trim(), manifest.version);
    });
});
