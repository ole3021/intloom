import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Run the same imports and storage probes against local archives and npm publications. */
export async function verifyConsumerImports(directory: string) {
  const consumer = resolve(directory, "release-consumer.mjs");
  await copyFile(new URL("./consumer.mjs", import.meta.url), consumer);
  await run(process.execPath, [consumer], { cwd: directory });
}

/** Exercise public setup commands through either a built CLI or a global launcher. */
export async function verifyCliSetup(options: {
  command: readonly [string, ...string[]];
  directory: string;
  version: string;
  loomPackage: string;
  loomSource: string;
}) {
  const {
    command: [executable, ...prefix],
    directory,
    version,
    loomPackage,
    loomSource,
  } = options;
  const execute = (args: string[]) =>
    run(executable, [...prefix, ...args], { cwd: directory, timeout: 180_000 });
  assert.equal((await execute(["--version"])).stdout.trim(), version);
  const help = (await execute(["--help", "--no-color"])).stdout;
  assert.match(help, /run\s/);
  assert.match(help, /looms\s/);
  assert.equal(help.includes(String.fromCharCode(27)), false);
  await execute([
    "init",
    "project",
    "--json",
    "--no-interactive",
    "--loom",
    loomSource,
  ]);
  const project = resolve(directory, "project");
  const request = async (args: string[]) =>
    JSON.parse(
      (await execute(["--project", project, ...args, "--json"])).stdout,
    ).data;
  const installed = await request(["loom", "list"]);
  assert.equal(installed.looms[0].name, loomPackage);
  assert.equal(installed.installation, "ready");
  const offline = await request(["doctor", "--execution", "cli"]);
  assert.equal(
    offline.checks.find((item: { name: string }) => item.name === "execution")
      .status,
    "not_checked",
  );
  await request(["loom", "remove", loomPackage]);
  assert.deepEqual((await request(["loom", "list"])).looms, []);
  await request(["loom", "add", loomSource]);
  try {
    await request(["start"]);
    const online = await request(["doctor", "--execution", "agent_ide"]);
    assert.equal(online.looms[0].isAvailable, true);
  } finally {
    await request(["stop"]);
  }
}
