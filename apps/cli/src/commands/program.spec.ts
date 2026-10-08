import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { temporaryDirectory } from "../../test/directory-fixture.ts";
import { runCli } from "./program.ts";

async function invoke(args: string[], cwd = process.cwd()) {
  const output = new PassThrough();
  const error = new PassThrough();
  let stdout = "";
  let stderr = "";
  output.on("data", (value) => {
    stdout += value;
  });
  error.on("data", (value) => {
    stderr += value;
  });
  const code = await runCli(args, {
    input: new PassThrough(),
    output,
    error,
    cwd,
    isTTY: false,
  });
  return { code, stdout, stderr };
}
test("help exposes project init and execution commands", async () => {
  const result = await invoke(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /flow \[options\]/u);
  assert.match(result.stdout, /init \[options\] \[directory\]/u);
  assert.doesNotMatch(result.stdout, /_auth-headers/u);
});
test("bad options return nonzero with a single machine error and no ANSI", async () => {
  for (const args of [
    ["--json", "start", "--port", "bad"],
    ["start", "--storage", "remote", "--json"],
    ["--json", "unknown"],
  ]) {
    const result = await invoke(args);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "INVALID_REQUEST");
    assert.equal(result.stderr, "");
  }
});
test("an invalid project does not pretend to be an offline service", async () => {
  const result = await invoke([
    "status",
    "--json",
    "--project",
    "/nonexistent/intloom-test",
  ]);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error.code, "CLI_PROJECT_INVALID");
});

test("retired project markers are rejected without creating local resources", async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(join(root, "intloom.config.yaml"), "intent: {apps: []}\n");
  const result = await invoke(["status", "--json", "--project", root]);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error.code, "CLI_PROJECT_INVALID");
  assert.deepEqual((await readdir(root)).sort(), [
    "intloom.config.yaml",
    "package.json",
  ]);
});

test("init selects cwd, a relative argument, or --project without prompting", async (t) => {
  const temporary = await temporaryDirectory(t);
  for (const [name, args] of [
    ["current", ["init"]],
    ["relative", ["init", "relative"]],
    ["option", ["--project", "option", "init"]],
  ] as const) {
    const root = join(temporary, name);
    if (name === "current") await mkdir(root);
    const result = await invoke(
      [...args, "--json", "--no-interactive"],
      name === "current" ? root : temporary,
    );
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      projectRoot: root,
      status: "scaffolded",
    });
  }
});

test("init rejects ambiguous and empty arguments before writing", async (t) => {
  const root = await temporaryDirectory(t);
  for (const args of [
    ["--project", "first", "init", "second"],
    ["init", "second", "--project", "first"],
    ["init", " "],
    ["--project", " ", "init"],
  ]) {
    const result = await invoke([...args, "--json"], root);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "INVALID_REQUEST");
    assert.deepEqual(await readdir(root), []);
  }
});

test("init reports the scaffold boundary and repeat-init errors", async (t) => {
  const root = await temporaryDirectory(t);
  const created = await invoke(["init", "--no-color"], root);
  assert.equal(created.code, 0);
  assert.match(created.stdout, /Configure llms.default in intloom.yaml/u);
  const config = await readFile(join(root, "intloom.yaml"), "utf8");
  const repeated = await invoke(["init", "--json"], root);
  assert.equal(repeated.code, 1);
  assert.equal(
    JSON.parse(repeated.stdout).error.code,
    "CLI_INIT_TARGET_NOT_EMPTY",
  );
  assert.equal(await readFile(join(root, "intloom.yaml"), "utf8"), config);
});

test("commands find the nearest marker, while explicit --project requires that exact root", async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(join(root, "intloom.yaml"), "workflows: []\n");
  const nested = join(root, "services/api/src");
  await mkdir(nested, { recursive: true });
  const found = await invoke(["status", "--json"], nested);
  assert.equal(found.code, 0, found.stdout);
  assert.equal(JSON.parse(found.stdout).projectRoot, root);
  const explicit = await invoke(
    ["--project", nested, "status", "--json"],
    root,
  );
  assert.equal(JSON.parse(explicit.stdout).error.code, "CLI_PROJECT_INVALID");
  await writeFile(join(root, "services/intloom.yaml"), "workflows: []\n");
  const nearest = await invoke(["doctor", "--json"], nested);
  assert.equal(JSON.parse(nearest.stdout).projectRoot, join(root, "services"));
});
