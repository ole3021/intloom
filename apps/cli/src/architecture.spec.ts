import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const source = fileURLToPath(new URL("./", import.meta.url));
const execute = promisify(execFile);

test("CMD and TUI stay independent and shared operations never depend on terminal adapters", async () => {
  const violations: string[] = [];
  for (const file of await readdir(source, { recursive: true })) {
    if (!/\.tsx?$/u.test(file) || /\.spec\.tsx?$/u.test(file)) continue;
    const layer = file.split(sep)[0];
    const shared = ["core", "client", "shared"].includes(layer ?? "");
    const content = await readFile(resolve(source, file), "utf8");
    for (const match of content.matchAll(
      /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/gu,
    )) {
      const specifier = match[1];
      if (!specifier) continue;
      const target = specifier.startsWith(".")
        ? relative(source, resolve(source, dirname(file), specifier)).split(
            sep,
          )[0]
        : undefined;
      if (
        (layer === "cmd" && target === "tui") ||
        (layer === "tui" && target === "cmd") ||
        (shared && (target === "cmd" || target === "tui")) ||
        (layer === "client" && target === "core") ||
        (shared &&
          /^(?:citty|@clack\/prompts|@opentui\/[^/]+|solid-js)(?:\/|$)/u.test(
            specifier,
          ))
      )
        violations.push(`${file} -> ${specifier}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("the public API and CMD help/version load without the TUI renderer", async () => {
  const entry = new URL("./index.ts", import.meta.url).href;
  const { stdout } = await execute(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { Readable, Writable } from "node:stream";
registerHooks({
  resolve(specifier, context, next) {
    assert.ok(!specifier.startsWith("@opentui/") && !/^solid-js(?:\\/|$)/u.test(specifier), specifier);
    return next(specifier, context);
  }
});
const api = await import(${JSON.stringify(entry)});
let output = "";
const io = {
  input: Readable.from([]),
  output: new Writable({ write(chunk, _encoding, done) { output += chunk; done(); } }),
  error: new Writable({ write(_chunk, _encoding, done) { done(new Error("Unexpected stderr")); } }),
  cwd: process.cwd(), isTTY: false,
};
assert.equal(await api.runCli(["--help", "--no-color"], io), 0);
assert.match(output, /CMD and TUI clients/);
output = "";
assert.equal(await api.runCli(["--version"], io), 0);
assert.match(output, /^\\d+\\.\\d+\\.\\d+/u);
assert.equal(typeof api.createCliCore().watchRun, "function");
process.stdout.write("ok");
`,
    ],
    { timeout: 15_000 },
  );
  assert.equal(stdout, "ok");
});
