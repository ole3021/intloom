import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the development launcher runs outside the checkout and preserves another command", (t) => {
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
  assert.match(help, /Usage: intloom-dev <check \| build> \[directory\]/);
  assert.ok(!help.includes("\x1b"));
  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(execFileSync(launcher, ["--version"], options).trim(), version);
  const removed = spawnSync(launcher, ["run", "example"], options);
  assert.equal(removed.status, 2);
  assert.match(removed.stderr, /Unsupported command/);

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
