import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { startService, stopService } from "@intloom/cli";
import { temporaryDirectory } from "./directory-fixture.ts";
import { cli } from "./project-fixture.ts";
import { packFixture, packDirectory } from "./workflow-fixture.ts";

async function configure(root: string) {
  await writeFile(
    join(root, "intloom.yaml"),
    (await readFile(join(root, "intloom.yaml"), "utf8")) +
      `
llms:
  default:
    provider: openai-compatible
    model: fixture
    secret: ENV.INTLOOM_UNUSED_TEST_KEY
`,
  );
}

test("new projects use YAML storage selection and recover the durable directory lock without changing data", async (t) => {
  const root = await temporaryDirectory(t, async (directory) => {
    await stopService(directory).catch(() => {});
  });
  const initialized = await cli(root, ["init", "--json"]);
  assert.equal(initialized.code, 0, initialized.stdout);
  await configure(root);
  const retiredOption = await cli(root, [
    "start",
    "--storage",
    "sqlite",
    "--json",
  ]);
  assert.equal(retiredOption.code, 1);
  assert.equal(JSON.parse(retiredOption.stdout).error.code, "INVALID_REQUEST");
  await startService({ projectRoot: root });
  const manifest = await readFile(join(root, "intloom/store.json"));
  await stopService(root);
  await writeFile(
    join(root, "intloom/store.lock"),
    JSON.stringify({ pid: 999999999, createdAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
  const diagnosis = await cli(root, ["doctor", "--json"]);
  assert.equal(JSON.parse(diagnosis.stdout).status, "recovery_required");
  const preview = await cli(root, ["recover", "--dry-run", "--json"]);
  assert.deepEqual(JSON.parse(preview.stdout).paths, ["intloom/store.lock"]);
  const recovered = await cli(root, ["recover", "--json"]);
  assert.equal(recovered.code, 0, recovered.stdout);
  assert.deepEqual(await readFile(join(root, "intloom/store.json")), manifest);
  await assert.rejects(readFile(join(root, "intloom/store.lock")), {
    code: "ENOENT",
  });
  const filename = join(root, "intloom.yaml");
  await writeFile(
    filename,
    (await readFile(filename, "utf8")).replace(
      "localStorage: file",
      "localStorage: sqlite",
    ),
  );
  await assert.rejects(startService({ projectRoot: root }), {
    code: "CLI_STORAGE_CONFLICT",
  });
  await assert.rejects(readFile(join(root, "intloom/storage.sqlite")), {
    code: "ENOENT",
  });
});

test("bare package installs registry latest, pins archive identity, disables scripts and restores the pinned version without changing user config", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t, async (directory) => {
    await stopService(join(directory, "project")).catch(() => {});
  });
  const first = await packFixture(base, "1.0.0");
  const second = await packFixture(base, "2.0.0");
  const bytes = new Map([
    ["1.0.0", await readFile(first.archive)],
    ["2.0.0", await readFile(second.archive)],
  ]);
  let latest = "1.0.0";
  let url = "";
  const server = createServer((req, res) => {
    const version = /fixture-workflow-(1\.0\.0|2\.0\.0)\.tgz$/.exec(
      req.url ?? "",
    )?.[1];
    if (version) {
      res.end(bytes.get(version));
      return;
    }
    if (req.url !== "/fixture-workflow") {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        name: "fixture-workflow",
        "dist-tags": { latest },
        versions: Object.fromEntries(
          [first, second].map(({ manifest }) => [
            manifest.version,
            {
              ...manifest,
              dist: {
                tarball: `${url}/-/fixture-workflow-${manifest.version}.tgz`,
                shasum: createHash("sha1")
                  .update(bytes.get(manifest.version) ?? "")
                  .digest("hex"),
              },
            },
          ]),
        ),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  url = `http://127.0.0.1:${address.port}`;
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  const previous = process.env.npm_config_registry;
  const previousCache = process.env.npm_config_cache;
  process.env.npm_config_registry = url;
  process.env.npm_config_cache = join(base, "npm-cache");
  t.after(() => {
    if (previous === undefined) delete process.env.npm_config_registry;
    else process.env.npm_config_registry = previous;
    if (previousCache === undefined) delete process.env.npm_config_cache;
    else process.env.npm_config_cache = previousCache;
  });
  const root = join(base, "project");
  const initialized = await cli(root, [
    "init",
    "--workflow",
    "fixture-workflow",
    "--json",
  ]);
  assert.equal(initialized.code, 0, initialized.stdout);
  const file = join(root, "intloom.yaml");
  const config = parse(await readFile(file, "utf8"));
  assert.deepEqual(config.workflows, [
    {
      name: "fixture-workflow",
      version: "1.0.0",
      sha256: createHash("sha256")
        .update(bytes.get("1.0.0") ?? "")
        .digest("hex"),
    },
  ]);
  const installed = join(
    root,
    ".intloom/workflows/node_modules/fixture-workflow",
  );
  await assert.rejects(readFile(join(installed, "SCRIPT_RAN")), {
    code: "ENOENT",
  });
  await startService({ projectRoot: root });
  await stopService(root);
  const before = await readFile(file, "utf8");
  latest = "2.0.0";
  await rm(join(root, ".intloom"), { recursive: true });
  await startService({ projectRoot: root });
  await stopService(root);
  assert.equal(
    JSON.parse(await readFile(join(installed, "package.json"), "utf8")).version,
    "1.0.0",
  );
  assert.equal(await readFile(file, "utf8"), before);
  await writeFile(
    join(installed, "index.js"),
    "throw new Error('must not import damaged code');",
  );
  await startService({ projectRoot: root });
  await stopService(root);
  assert.equal(
    await readFile(join(installed, "index.js"), "utf8"),
    "export const fixture = true;\n",
  );
  const selected = join(base, "version-selected");
  const exact = await cli(selected, [
    "init",
    "--workflow",
    "fixture-workflow@1.0.0",
    "--json",
  ]);
  assert.equal(exact.code, 0, exact.stdout);
  assert.equal(
    parse(await readFile(join(selected, "intloom.yaml"), "utf8")).workflows[0]
      .version,
    "1.0.0",
  );
});

test("local archives are checked during restore; invalid packages and duplicate names leave no project scaffold", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t);
  const valid = await packFixture(base, "1.0.0");
  const other = await packFixture(base, "2.0.0", false);
  for (const [name, args] of [
    ["invalid", ["--workflow", other.archive]],
    ["duplicate", ["--workflow", valid.archive, "--workflow", valid.archive]],
  ] as const) {
    const root = join(base, name);
    const result = await cli(root, ["init", ...args, "--json"]);
    assert.equal(result.code, 1);
    assert.deepEqual(await readdir(root), []);
  }
  const root = join(base, "valid");
  const result = await cli(root, [
    "init",
    "--workflow",
    valid.archive,
    "--json",
  ]);
  assert.equal(result.code, 0, result.stdout);
  await configure(root);
  const before = await readFile(join(root, "intloom.yaml"), "utf8");
  await rm(join(root, ".intloom"), { recursive: true });
  await writeFile(
    join(base, "fixture-1.0.0/index.js"),
    "export const changed = true;\n",
  );
  await packDirectory(join(base, "fixture-1.0.0"), base);
  await assert.rejects(startService({ projectRoot: root }), {
    code: "CLI_WORKFLOW_INTEGRITY_FAILED",
  });
  assert.equal(await readFile(join(root, "intloom.yaml"), "utf8"), before);
  await assert.rejects(readFile(join(root, "intloom/store.json")), {
    code: "ENOENT",
  });
});
