import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { registryVersion } from "./registry.ts";
import { readReleaseManifest } from "./release-files.ts";

const release = await readReleaseManifest();
if (process.env.GITHUB_SHA && release.commit !== process.env.GITHUB_SHA)
  throw new Error("Release commit mismatch.");
for (const entry of release.entries) {
  if (
    (await registryVersion(entry.name, entry.version))?.integrity !==
    entry.integrity
  )
    throw new Error(`Registry integrity mismatch: ${entry.name}`);
}
const temporary = await mkdtemp(resolve(tmpdir(), "intloom-published-"));
const run = promisify(execFile);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
try {
  for (const launcher of ["@intloom/cli", "intloom"] as const) {
    const project = resolve(
      temporary,
      launcher === "intloom" ? "launcher" : "scoped",
    );
    await mkdir(project);
    const dependencies = Object.fromEntries(
      Object.entries(release.versions).filter(
        ([name]) =>
          name === launcher || !["intloom", "@intloom/cli"].includes(name),
      ),
    );
    // Unchanged packages install from the registry; only selected versions have new archive checksums.
    await writeFile(
      resolve(project, "package.json"),
      JSON.stringify({ type: "module", dependencies }),
    );
    await run(npm, ["install", "--no-audit", "--no-fund"], {
      cwd: project,
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
    });
    await writeFile(
      resolve(project, "consumer.mjs"),
      `
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { compileWorkflow } from "@intloom/compiler";
import { workflowProtocolVersion } from "@intloom/workflow-sdk";
import { blueprint } from "@intloom/workflow-intent";
assert.equal(typeof compileWorkflow,"function");
assert.equal(workflowProtocolVersion,createRequire(import.meta.url)("@intloom/workflow-intent/package.json").intloom.version);
assert.equal(blueprint.flowName,"intent");
await assert.rejects(import("@intloom/kernel"),{code:"ERR_MODULE_NOT_FOUND"});
const require = createRequire(import.meta.resolve("@intloom/cli"));
for (const [specifier, options] of [["file",{directory:resolve("file-store")}],["sqlite",{filename:resolve("store.sqlite"),projectId:"published"}]]) {
 const storage = await import(pathToFileURL(require.resolve("@intloom/kernel/storage/"+specifier)).href);
 const handle = await (specifier === "file" ? storage.openFileStorage(options) : storage.openSqliteStorage(options));
 try {await handle.access.commit([{type:"append_record",id:"published",payload:{flowName:"intent",stageName:"specification",data:"verified"}}]);assert.equal((await handle.access.getRecordById("published")).data,"verified");}
 finally {await handle.dispose();}
}
`,
    );
    await run(process.execPath, [resolve(project, "consumer.mjs")], {
      cwd: project,
    });
    // Isolated global prefixes exercise each advertised install command without changing the user's global bin.
    const prefix = resolve(project, "global");
    await run(
      npm,
      [
        "install",
        "--global",
        "--prefix",
        prefix,
        `${launcher}@${release.versions[launcher]}`,
        "--no-audit",
        "--no-fund",
      ],
      { cwd: project, timeout: 180_000, maxBuffer: 1024 * 1024 },
    );
    const bin =
      process.platform === "win32"
        ? resolve(prefix, "intloom.cmd")
        : resolve(prefix, "bin/intloom");
    const { stdout: version } = await run(bin, ["--version"], { cwd: project });
    assert.equal(version.trim(), release.versions["@intloom/cli"]);
    const { stdout: help } = await run(bin, ["--help", "--no-color"], {
      cwd: project,
    });
    assert.match(help, /flow \[options\]/);
    assert.equal(help.includes(String.fromCharCode(27)), false);
    await run(
      bin,
      [
        "init",
        "project",
        "--json",
        "--no-interactive",
        "--workflow",
        `@intloom/workflow-intent@${release.versions["@intloom/workflow-intent"]}`,
      ],
      { cwd: project, timeout: 180_000 },
    );
    const initializedProject = resolve(project, "project");
    const command = (args: string[]) =>
      run(bin, ["--project", initializedProject, ...args, "--json"], {
        cwd: project,
        timeout: 180_000,
      });
    const installed = JSON.parse((await command(["workflow", "list"])).stdout);
    assert.equal(installed.workflows[0].name, "@intloom/workflow-intent");
    assert.equal(installed.installation, "ready");
    const offline = JSON.parse(
      (await command(["doctor", "--execution", "cli"])).stdout,
    );
    assert.equal(
      offline.checks.find((item: { name: string }) => item.name === "execution")
        .status,
      "attention",
    );
    await command(["workflow", "remove", "@intloom/workflow-intent"]);
    assert.deepEqual(
      JSON.parse((await command(["workflow", "list"])).stdout).workflows,
      [],
    );
    await command([
      "workflow",
      "add",
      `@intloom/workflow-intent@${release.versions["@intloom/workflow-intent"]}`,
    ]);
    try {
      await command(["start"]);
      const online = JSON.parse(
        (await command(["doctor", "--execution", "agent_ide"])).stdout,
      );
      assert.equal(online.workflows[0].isAvailable, true);
    } finally {
      await command(["stop"]);
    }
  }
  console.log(
    "Both npm global entries, Workflow imports, CLI initialization/package management, host diagnostics, and file/SQLite storage passed. Remote model execution is a separate acceptance.",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
