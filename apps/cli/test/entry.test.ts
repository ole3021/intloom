import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const binary = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
const cli = (...args: string[]) =>
  spawnSync(process.execPath, [binary, ...args], { encoding: "utf8" });

test("command options are scoped, help stays discoverable, and removed commands are rejected", () => {
  for (const args of [
    ["status", "--overwrite"],
    ["status", "--details"],
    ["startup", "--data-dir", "/tmp/unused"],
    ["startup", "--project", "."],
    ["status", "--limit", "10"],
    ["status", "--cursor", "x"],
    ["status", "--status", "waiting"],
    ["startup", "--port", "0"],
    ["startup", "--port", "65536"],
    ["startup", "--port", "abc"],
    ["build"],
    ["pack"],
    ["deps", "resolve"],
    ["loom", "get", "unused"],
    ["loom", "inspect", "unused.tgz"],
    ["run", "list", "--status", "waiting"],
    ["run", "package", "subcommand", "extra"],
    ["serve"],
    ["start"],
    ["mcp"],
    ["host", "status"],
    ["run", "unused-loom", "--until", "invalid"],
    ["run", "unused-loom", "--timeout", "invalid"],
    ["dev", "test", "--build", "--timeout", "-1"],
    ["status", "--timeout", "1"],
    ["dev", "publish", "--build"],
    ["artifact", "get", "id", "--out", "/tmp/output"],
  ]) {
    const result = cli(...args, "--plain");
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).error.code, "INVALID_ARGUMENT");
  }
  // An option value that happens to be 'mcp' is not the command.
  const plain = cli("--project", "mcp", "--plain", "status", "--overwrite");
  assert.equal(JSON.parse(plain.stdout).error.code, "INVALID_ARGUMENT");
  for (const args of [
    ["dev", "--help"],
    ["startup", "--help"],
    ["run", "stop", "--help"],
    ["--plain", "artifact", "export", "--help"],
  ])
    assert.equal(cli(...args).status, 0);
});

test("version and help load no Kernel, Compiler, Mastra or MCP implementation", () => {
  const guard = `import {registerHooks} from 'node:module'; registerHooks({resolve(specifier,context,next) { const result=next(specifier,context); if (/\\/(?:kernel|compiler)\\/dist\\/|\\/(?:@mastra|@modelcontextprotocol)\\//.test(result.url)) throw Error('Unexpected heavy dependency: '+result.url); return result; }});`;
  for (const args of [
    ["--version"],
    ["--plain", "--version"],
    ["--help"],
    ["startup", "--help"],
    ["--plain", "run", "--help"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(guard)}`,
        binary,
        ...args,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.trim());
  }
});
