import { cliArgs, shutdown } from "./cli.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { compileLoom } from "@intloom/compiler";
import { serve } from "@intloom/kernel";

await mkdir("lifecycle-author");
await writeFile(
  "lifecycle-author/package.json",
  JSON.stringify({ name: "code-run", type: "module" }),
);
await cp("lifecycle-code.ts", "lifecycle-author/loom.ts");
await writeFile("lifecycle-author/guide.txt", "consumer resource");
const compiled = await compileLoom({
  entryFile: "lifecycle-author/loom.ts",
  outDir: "lifecycle-compiled",
});
assert.ok(compiled.ok, JSON.stringify(compiled));
assert.equal(compiled.manifest.build.target, "node22");
assert.equal(
  compiled.manifest.requirements.node,
  "^22.22.0 || ^24.0.0 || ^26.0.0",
);
const host = await serve({ dataDir: "lifecycle-sdk" });
const ref = await host.installLoom({ source: compiled.artifactDir });
const run = await host.createRun({ loom: ref, input: {} });
assert.equal(run.status, "created");
assert.equal((await host.startRun(run.id)).disposition, "accepted");
const legacy = await compileLoom({
  entryFile: "lifecycle-author/loom.ts",
  outDir: "lifecycle-node26",
  target: "node26",
});
assert.ok(legacy.ok, JSON.stringify(legacy));
assert.equal(legacy.manifest.build.target, "node26");
assert.equal(legacy.manifest.requirements.node, ">=26.13.0 <27");
const kernelRequire = createRequire(import.meta.resolve("@intloom/kernel"));
if (
  kernelRequire("semver").satisfies(
    process.versions.node,
    legacy.manifest.requirements.node,
  )
) {
  const old = await host.installLoom({ source: legacy.artifactDir });
  const oldRun = await host.createRun({ loom: old, input: {} });
  await host.startRun(oldRun.id);
} else {
  await assert.rejects(host.installLoom({ source: legacy.artifactDir }), {
    code: "TARGET_UNSUPPORTED",
  });
}
await host.close();
const { createClient } = kernelRequire("@libsql/client");
const database = createClient({
  url: `file:${run.location.dataDir}/kernel.db`,
});
try {
  const { rows } = await database.execute({
    sql: "SELECT json_extract(record, '$.binding.runtime.nodeMajor') AS major FROM runs WHERE id = ?",
    args: [run.id],
  });
  assert.equal(rows[0].major, Number.parseInt(process.versions.node, 10));
} finally {
  database.close();
}
await rm("lifecycle-author", { recursive: true });
const reopened = await serve({ dataDir: "lifecycle-sdk" });
const result = await reopened.getRunResult(run.id);
assert.equal(result.runStatus, "succeeded");
assert.equal(result.output.value, 7);
assert.equal(result.output.resource, "consumer resource");
assert.equal(result.output.normalizations, 1);
const summaries = await reopened.listRuns({ limit: 100 });
assert.ok(summaries.items.some((summary) => summary.id === run.id));
assert.ok(summaries.items.every((summary) => !("output" in summary)));
assert.deepEqual((await reopened.getRun(run.id)).output, result.output);
assert.equal((await reopened.startRun(run.id)).disposition, "no_change");
await reopened.close();

const cli = resolve("node_modules/.bin/intloom");
const dataDir = resolve("lifecycle-cli");
const exec = promisify(execFile);
const child = spawn(
  process.execPath,
  [...cliArgs(cli, dataDir), "startup", "--plain"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let stderr = "";
child.stderr.on("data", (data) => {
  stderr += data;
});
try {
  const ready = await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error(stderr);
    }),
  ]);
  assert.equal(JSON.parse(String(ready[0])).data.status, "ready");
  const command = async (...args) =>
    JSON.parse(
      (
        await exec(process.execPath, [
          ...cliArgs(cli, dataDir),
          ...args,
          "--plain",
        ])
      ).stdout,
    ).data;
  const installed = await command("install", compiled.artifactDir);
  const started = await command(
    "run",
    installed.artifactDigest,
    "--input",
    "{}",
  );
  assert.equal(started.status, "succeeded");
  assert.equal(started.output.resource, "consumer resource");
  const slow = await command(
    "run",
    "create",
    installed.artifactDigest,
    "--input",
    '{"mode":"slow"}',
  );
  await command("run", "start", slow.id);
  const exited = once(child, "exit");
  await shutdown(cli, dataDir);
  assert.deepEqual(await exited, [0, null]);
  const verify = await serve({ dataDir });
  assert.equal((await verify.getRun(slow.id)).status, "cancelled");
  await verify.close();
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
}
console.log(
  "lifecycle-consumer: packaged SDK/CLI install, Code execution, default once, persisted results, IPC and graceful drain verified",
);
