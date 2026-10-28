import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { promisify } from "node:util";
import { temporaryDirectory } from "../../test/directory-fixture.ts";
import { runCmd as runCli } from "./index.ts";

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
  assert.match(result.stdout, /run\s+Run a Loom with the supplied inputs/u);
  assert.match(result.stdout, /init\s+Initialize project/u);
  assert.doesNotMatch(result.stdout, /_auth-headers/u);
  assert.equal(result.stdout.includes("\u001b"), false);
});
test("help stays plain when redirected or color is disabled even if Citty enables ANSI", async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, TERM: "xterm-256color" };
  delete env.NO_COLOR;
  delete env.CI;
  delete env.TEST;
  const entry = new URL("./index.ts", import.meta.url).href;
  for (const terminal of [false, true]) {
    const script = `
      import { PassThrough } from "node:stream";
      import { runCmd as runCli } from ${JSON.stringify(entry)};
      const output = Object.assign(new PassThrough(), { isTTY: ${terminal} });
      output.on("data", chunk => process.stdout.write(chunk));
      process.exitCode = await runCli(${JSON.stringify(terminal ? ["--help", "--no-color"] : ["--help"])}, {
        input: new PassThrough(), output, error: process.stderr,
        cwd: process.cwd(), isTTY: ${terminal},
      });
    `;
    const result = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "-e", script],
      { env },
    );
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.match(result.stdout, /run\s+Run a Loom with the supplied inputs/u);
    assert.match(result.stdout, /init\s+Initialize project/u);
  }
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
    const resultData = JSON.parse(result.stdout);
    assert.equal(resultData.ok, true);
    assert.equal(resultData.data.projectRoot, root);
    assert.deepEqual(
      resultData.data.steps.map((step: { status: string }) => step.status),
      ["completed", "skipped", "skipped", "skipped"],
    );
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
  await writeFile(join(root, "intloom.yaml"), "looms: []\n");
  const nested = join(root, "services/api/src");
  await mkdir(nested, { recursive: true });
  const found = await invoke(["status", "--json"], nested);
  assert.equal(found.code, 0, found.stdout);
  assert.equal(JSON.parse(found.stdout).data.projectRoot, root);
  const explicit = await invoke(
    ["--project", nested, "status", "--json"],
    root,
  );
  assert.equal(JSON.parse(explicit.stdout).error.code, "CLI_PROJECT_INVALID");
  await writeFile(join(root, "services/intloom.yaml"), "looms: []\n");
  const nearest = await invoke(["doctor", "--json"], nested);
  assert.equal(
    JSON.parse(nearest.stdout).data.projectRoot,
    join(root, "services"),
  );
});

test("developer commands create, inspect and check a source package without starting a Service", async (t) => {
  const cwd = await temporaryDirectory(t);
  const created = await invoke(
    ["new", "sample", "--template", "code", "--json"],
    cwd,
  );
  assert.equal(created.code, 0, created.stdout);
  const inspected = await invoke(["inspect", "sample", "--json"], cwd);
  assert.equal(inspected.code, 0, inspected.stdout);
  assert.equal(JSON.parse(inspected.stdout).data.definition.name, "sample");
  const checked = await invoke(["check", "sample", "--json"], cwd);
  assert.equal(checked.code, 0, checked.stdout);
  assert.equal((await readdir(join(cwd, "sample"))).includes("dist"), false);
  const duplicate = await invoke(["new", "sample", "--json"], cwd);
  assert.equal(duplicate.code, 1);
  await writeFile(join(cwd, "intloom.yaml"), "useMcpAgent: false\n");
  const input = await invoke(
    ["run", "sample", "--input", "{}", "--prompt", "conflict", "--json"],
    cwd,
  );
  assert.equal(input.code, 1);
  assert.match(JSON.parse(input.stdout).error.message, /cannot combine/);
});
