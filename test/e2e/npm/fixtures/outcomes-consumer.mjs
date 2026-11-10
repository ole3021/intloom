import { cliArgs, shutdown } from "./cli.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, cp, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { compileLoom, packLoom } from "@intloom/compiler";
import { serve } from "@intloom/kernel";
await mkdir("outcomes-author");
await writeFile(
  "outcomes-author/package.json",
  JSON.stringify({ name: "outcomes-outcome", type: "module" }),
);
await cp("outcomes-outcome.ts", "outcomes-author/loom.ts");
const built = await compileLoom({
  entryFile: "outcomes-author/loom.ts",
  outDir: "outcomes-compiled",
  target: "node22",
});
assert.ok(built.ok, JSON.stringify(built));
const packed = await packLoom({
  artifactDir: built.artifactDir,
  outFile: "outcomes.tgz",
});
await rm("outcomes-author", { recursive: true });
await rm("outcomes-compiled", { recursive: true });
let host = await serve({ dataDir: "outcomes-sdk" });
const loom = await host.installLoom({ source: packed.archiveFile });
const run = await host.createRun({
  loom,
  input: { mode: "pass", size: 1048583 },
});
await host.startRun(run.id);
await host.close();
host = await serve({ dataDir: "outcomes-sdk" });
const expected = await host.getRunResult(run.id);
assert.equal(expected.quality, "passed");
const ref = expected.outcome.deliveries.report[0];
const metadata = await host.getArtifact(ref.id);
assert.equal(
  (await host.getAcceptance(expected.acceptance.id)).subjectDigest,
  expected.acceptance.subjectDigest,
);
const first = await host.readArtifact({ artifactId: ref.id });
assert.equal(first.length, 1048576);
assert.equal(first.eof, false);
const last = await host.readArtifact({
  artifactId: ref.id,
  offset: first.length,
});
assert.equal(last.length, 7);
assert.equal(last.eof, true);
const full = Buffer.concat([first.data, last.data]);
assert.equal(createHash("sha256").update(full).digest("hex"), metadata.digest);
await host.close();
const cli = resolve("node_modules/.bin/intloom"),
  dataDir = resolve("outcomes-sdk"),
  exec = promisify(execFile);
async function command(...args) {
  try {
    return JSON.parse(
      (
        await exec(process.execPath, [
          ...cliArgs(cli, dataDir),
          ...args,
          "--plain",
        ])
      ).stdout,
    );
  } catch (error) {
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}
let child;
try {
  child = spawn(
    process.execPath,
    [...cliArgs(cli, dataDir), "startup", "--plain"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let errors = "";
  child.stderr.on("data", (value) => {
    errors += value;
  });
  const ready = await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error(errors);
    }),
  ]);
  assert.equal(JSON.parse(String(ready[0])).data.status, "ready");
  assert.deepEqual((await command("status", run.id)).data.result, expected);
  const list = (
    await command("artifact", "list", "--run", run.id, "--limit", "1")
  ).data;
  assert.equal(list.items.length, 1);
  assert.ok(list.nextCursor);
  const next = (
    await command(
      "artifact",
      "list",
      "--run",
      run.id,
      "--limit",
      "1",
      "--cursor",
      list.nextCursor,
    )
  ).data;
  assert.notEqual(list.items[0].id, next.items[0].id);
  assert.equal(
    (await command("acceptance", "list", "--run", run.id)).data.items.length,
    1,
  );
  assert.equal(
    (await command("acceptance", "get", expected.acceptance.id)).data.status,
    "passed",
  );
  assert.equal(
    (await command("artifact", "get", ref.id)).data.digest,
    metadata.digest,
  );
  const range = (
    await command(
      "artifact",
      "read",
      ref.id,
      "--offset",
      "1048574",
      "--length",
      "9",
    )
  ).data;
  assert.equal(range.encoding, "base64");
  assert.equal(range.eof, true);
  assert.deepEqual(Buffer.from(range.data, "base64"), full.subarray(1048574));
  const raw = await exec(
    process.execPath,
    [
      ...cliArgs(cli, dataDir),
      "artifact",
      "read",
      ref.id,
      "--offset",
      "1",
      "--length",
      "5",
    ],
    { encoding: "buffer" },
  );
  assert.deepEqual(raw.stdout, full.subarray(1, 6));
  const out = resolve("outcomes-export.bin");
  assert.equal(
    (await command("artifact", "export", ref.id, "--out", out)).ok,
    true,
  );
  assert.deepEqual(await readFile(out), full);
  await writeFile(out, "preserve");
  assert.equal(
    (await command("artifact", "export", ref.id, "--out", out)).error.code,
    "FILE_EXISTS",
  );
  assert.equal(await readFile(out, "utf8"), "preserve");
  assert.equal(
    (await command("artifact", "export", ref.id, "--out", out, "--overwrite"))
      .ok,
    true,
  );
  assert.deepEqual(await readFile(out), full);
  const rejected = (
    await command(
      "run",
      loom.artifactDigest,
      "--input",
      '{"mode":"reject","size":3}',
    )
  ).data;
  assert.equal(rejected.status, "succeeded");
  assert.equal(
    (await command("status", rejected.id)).data.result.quality,
    "rejected",
  );
  const failed = (
    await command(
      "run",
      loom.artifactDigest,
      "--input",
      '{"mode":"error","size":3}',
    )
  ).data;
  assert.equal(failed.status, "failed");
  assert.equal(
    (await command("status", failed.id)).data.result.error.code,
    "ACCEPTANCE_EXECUTION_FAILED",
  );
  const ended = once(child, "exit");
  assert.equal((await shutdown(cli, dataDir)).status, "stopped");
  assert.deepEqual(await ended, [0, null]);
} finally {
  if (child?.exitCode === null && child.signalCode === null) {
    const ended = once(child, "exit");
    child.kill("SIGKILL");
    await ended;
  }
}
console.log(
  "outcomes-consumer: packaged SDK/CLI immutable artifacts, acceptance, quality, archive installation, bounded reads, binary export and overwrite protection verified",
);
