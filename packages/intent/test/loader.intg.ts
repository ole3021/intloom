import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { discoverLooms, initializeLooms, loadLoom } from "@intloom/kernel/loom";
import { modelConfig } from "./loader-fixture.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

test("loads built workspace Intent with resources relative to its resolved entry", async (t) => {
  const previous = process.env.INTLOOM_PACKED_TEST_KEY;
  process.env.INTLOOM_PACKED_TEST_KEY = "fixture-credential";
  t.after(() => {
    if (previous === undefined) delete process.env.INTLOOM_PACKED_TEST_KEY;
    else process.env.INTLOOM_PACKED_TEST_KEY = previous;
  });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Initialization must not call the model");
  });
  const project = await mkdtemp(resolve(tmpdir(), "intent-local-"));
  t.after(() => rm(project, { recursive: true, force: true }));
  const installation = resolve(project, ".intloom/looms");
  await mkdir(resolve(installation, "node_modules/@intloom"), {
    recursive: true,
  });
  await symlink(
    resolve(root, "dist"),
    resolve(installation, "node_modules/@intloom/intent"),
    "dir",
  );
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const config = modelConfig(manifest.version);
  const {
    sources: [source],
    failures,
  } = await discoverLooms(installation, config.looms);
  assert.deepEqual(failures, []);
  assert.ok(source);
  assert.equal(source.assetRoot, source.packageRoot);
  const loom = await loadLoom(source);
  assert.equal(loom.blueprint.loomName, "intent");
  const result = await initializeLooms({
    projectRoot: project,
    config,
  });
  assert.deepEqual(result.looms, [
    {
      packageName: "@intloom/intent",
      loomName: "intent",
      isAvailable: true,
    },
  ]);
  for (const agent of Object.values(result.registries.agents)) {
    assert.equal(agent.spec.skills.length, 1);
    assert.ok(agent.spec.tools.length >= 2);
  }
});
