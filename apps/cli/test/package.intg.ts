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
import { join, resolve } from "node:path";
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
  const packages: Record<string, string> = {};
  for (const [name, directory] of [
    ["cli", "apps/cli/.publish"],
    ["intloom", "apps/cli/.publish-intloom"],
    ["workflow-sdk", "packages/workflow-sdk"],
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
          dependencies: { [launcher]: `file:${archiveFor(launcher)}` },
          overrides: Object.fromEntries(
            Object.entries(packages).map(([name, file]) => [
              name,
              `file:${file}`,
            ]),
          ),
        }),
      );
      await run("npm", ["install", "--no-audit", "--no-fund"], {
        cwd: project,
        timeout: 90_000,
        maxBuffer: 1024 * 1024,
      });
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
        'import assert from "node:assert/strict"; import { runCli, startService, startProjectHost, connectProject, connectProjectClient, discoverProjectConnection, addWorkflow, removeWorkflow, listInstalledWorkflows, doctorProject } from "@intloom/cli"; for (const item of [runCli, startService, startProjectHost, connectProject, connectProjectClient, discoverProjectConnection, addWorkflow, removeWorkflow, listInstalledWorkflows, doctorProject]) assert.equal(typeof item, "function"); await assert.rejects(import("@intloom/kernel"), { code: "ERR_MODULE_NOT_FOUND" });',
      );
      await run(process.execPath, [consumer], { cwd: project });
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
