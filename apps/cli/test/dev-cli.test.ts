import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the development launcher runs in the caller's project and respects an existing command", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "intloom-dev-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const binDir = join(cwd, "dev bin");
  const launcher = join(binDir, "intloom-dev");
  const args = [
    fileURLToPath(new URL("../scripts/install-dev-cli.ts", import.meta.url)),
    "--bin-dir",
    binDir,
  ];
  const options = { cwd, encoding: "utf8" } as const;
  execFileSync(process.execPath, args, options);
  execFileSync(process.execPath, args, options);
  const help = execFileSync(launcher, ["--help"], options);
  assert.match(help, /intloom-dev status --watch/);
  assert.ok(!help.includes("\x1b"));
  const helpJson = JSON.parse(
    execFileSync(launcher, ["dev", "build", "--help", "--plain"], options),
  );
  assert.equal(helpJson.ok, true);
  assert.match(helpJson.data.help, /intloom-dev dev build/);
  assert.equal(execFileSync(launcher, ["--version"], options).trim(), "0.4.0");
  assert.equal(
    JSON.parse(execFileSync(launcher, ["--version", "--plain"], options)).data
      .version,
    "0.4.0",
  );
  const removed = spawnSync(launcher, ["status", "--json"], options);
  assert.equal(removed.status, 2);
  assert.match(removed.stderr, /Invalid command options/);
  assert.doesNotMatch(help, /--json/);
  execFileSync(
    launcher,
    ["dev", "init", "my project", "--id", "my-loom", "--name", "My Loom"],
    options,
  );
  assert.match(
    readFileSync(join(cwd, "my project", "loom.yaml"), "utf8"),
    /My Loom/,
  );

  const other = readFileSync(launcher, "utf8").replace(
    /^# Entry: .*$/m,
    '# Entry: "/another/checkout/apps/cli/dist/bin.js"',
  );
  writeFileSync(launcher, other);
  const conflict = spawnSync(process.execPath, args, options);
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /Refusing to replace/);
  assert.equal(readFileSync(launcher, "utf8"), other);
});
