import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { parseDocument, parse } from "yaml";
import {
  addWorkflow,
  removeWorkflow,
  listInstalledWorkflows,
  startService,
  stopService,
  doctorProject,
} from "@intloom/cli";
import { temporaryDirectory } from "./directory-fixture.ts";
import { cli } from "./project-fixture.ts";
import { packFixture } from "./workflow-fixture.ts";

test("a user edit during package fetching aborts publication and preserves both the edit and old installation", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t);
  const root = join(base, "project");
  const fixture = await packFixture(base, "1.0.0");
  const bytes = await readFile(fixture.archive);
  assert.equal((await cli(root, ["init", "--json"])).code, 0);
  const file = join(root, "intloom.yaml");
  const edited = `${await readFile(file, "utf8")}\n# Concurrent user edit\n`;
  let url = "";
  const server = createServer((req, res) => {
    void (async () => {
      if (req.url?.endsWith(".tgz")) {
        res.end(bytes);
        return;
      }
      if (req.url !== "/fixture-workflow") {
        res.writeHead(404).end();
        return;
      }
      await writeFile(file, edited);
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          name: "fixture-workflow",
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              ...fixture.manifest,
              dist: {
                tarball: `${url}/fixture-workflow.tgz`,
                shasum: createHash("sha1").update(bytes).digest("hex"),
              },
            },
          },
        }),
      );
    })().catch(() => res.writeHead(500).end());
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
  const registry = process.env.npm_config_registry;
  const cache = process.env.npm_config_cache;
  process.env.npm_config_registry = url;
  process.env.npm_config_cache = join(base, "cache");
  try {
    await assert.rejects(addWorkflow(root, "fixture-workflow"), {
      code: "CONFLICT",
    });
  } finally {
    if (registry === undefined) delete process.env.npm_config_registry;
    else process.env.npm_config_registry = registry;
    if (cache === undefined) delete process.env.npm_config_cache;
    else process.env.npm_config_cache = cache;
  }
  assert.equal(await readFile(file, "utf8"), edited);
  assert.deepEqual(await readdir(join(root, ".intloom/workflows")), []);
  assert.equal((await listInstalledWorkflows(root)).installation, "empty");
});

test("installed CLI manages packages offline, preserves user YAML, rejects duplicates and unavailable mutations, and repairs declaration/cache mismatch", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t, async (directory) => {
    await stopService(join(directory, "project")).catch(() => {});
  });
  const root = join(base, "project");
  const first = await packFixture(base, "1.0.0");
  const second = await packFixture(base, "2.0.0");
  const invalid = await packFixture(base, "3.0.0", false);
  assert.equal((await cli(root, ["init", "--json"])).code, 0);
  const file = join(root, "intloom.yaml");
  const original =
    (await readFile(file, "utf8")) +
    "\n# Preserve the user's model settings and Unicode.\nllms:\n  default:\n    provider: openai-compatible\n    model: '模型' # user comment\n    secret: ENV.UNUSED_TEST_CREDENTIAL\n";
  await writeFile(file, original);
  const added = await cli(root, ["workflow", "add", first.archive, "--json"]);
  assert.equal(added.code, 0, added.stdout);
  assert.equal(JSON.parse(added.stdout).installation, "ready");
  const after = await readFile(file, "utf8");
  assert.match(after, /# user comment/);
  assert.match(after, /# Preserve the user's/);
  const { workflows: _before, ...beforeFields } = parse(original);
  const { workflows: _after, ...afterFields } = parse(after);
  assert.deepEqual(afterFields, beforeFields);
  const installed = join(
    root,
    ".intloom/workflows/node_modules/fixture-workflow",
  );
  await assert.rejects(readFile(join(installed, "SCRIPT_RAN")), {
    code: "ENOENT",
  });
  for (const archive of [first.archive, second.archive])
    await assert.rejects(addWorkflow(root, archive), { code: "CONFLICT" });
  await assert.rejects(addWorkflow(root, invalid.archive));
  assert.equal(await readFile(file, "utf8"), after);
  assert.equal((await listInstalledWorkflows(root)).installation, "ready");
  const listed = await cli(root, ["workflow", "list", "--json"]);
  assert.equal(JSON.parse(listed.stdout).workflows[0].version, "1.0.0");
  await startService({ projectRoot: root });
  await assert.rejects(removeWorkflow(root, "fixture-workflow"), {
    code: "CLI_SERVICE_BUSY",
  });
  const doctor = await doctorProject(root, "cli");
  // The fixture's package metadata is valid, but its exports are not a Workflow.
  assert.equal(doctor.workflows?.[0]?.isAvailable, false);
  assert.equal(
    doctor.checks.find((item) => item.name === "execution")?.status,
    "attention",
  );
  await stopService(root);
  const document = parseDocument(await readFile(file, "utf8"));
  document.set("workflows", []);
  await writeFile(file, document.toString());
  assert.equal(
    (await listInstalledWorkflows(root)).installation,
    "repair_required",
  );
  await startService({ projectRoot: root });
  await stopService(root);
  assert.equal((await listInstalledWorkflows(root)).installation, "empty");
  assert.deepEqual(
    await readdir(join(root, ".intloom/workflows/node_modules")),
    [],
  );
  await addWorkflow(root, second.archive);
  const removed = await cli(root, [
    "workflow",
    "remove",
    "fixture-workflow",
    "--json",
  ]);
  assert.equal(removed.code, 0, removed.stdout);
  assert.deepEqual(JSON.parse(removed.stdout).workflows, []);
  await assert.rejects(removeWorkflow(root, "fixture-workflow"), {
    code: "NOT_FOUND",
  });
});

test("concurrent package additions have one owner and leave one coherent configuration and installation", {
  timeout: 120_000,
}, async (t) => {
  const base = await temporaryDirectory(t);
  const root = join(base, "project");
  const fixture = await packFixture(base, "1.0.0");
  assert.equal((await cli(root, ["init", "--json"])).code, 0);
  const results = await Promise.allSettled([
    addWorkflow(root, fixture.archive),
    addWorkflow(root, fixture.archive),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = results.find((item) => item.status === "rejected");
  assert.equal(rejected?.reason.code, "CLI_SERVICE_BUSY");
  assert.equal((await listInstalledWorkflows(root)).workflows.length, 1);
  assert.equal((await listInstalledWorkflows(root)).installation, "ready");
});
