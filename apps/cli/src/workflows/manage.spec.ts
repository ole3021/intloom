import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  readFile,
  readdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryDirectory } from "../../test/directory-fixture.ts";
import { initProject } from "../commands/init.ts";
import { acquireServiceLock } from "../service/discovery.ts";
import {
  addWorkflow,
  listInstalledWorkflows,
  removeWorkflow,
} from "./manage.ts";
import { buildInstallation } from "./install.ts";

test("offline listing is read-only; unknown removals preserve configuration and release the lock", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  const before = await readFile(join(root, "intloom.yaml"), "utf8");
  const files = await readdir(root, { recursive: true });
  assert.deepEqual(await listInstalledWorkflows(root), {
    projectRoot: root,
    workflows: [],
    installation: "empty",
  });
  assert.deepEqual(await readdir(root, { recursive: true }), files);
  await assert.rejects(removeWorkflow(root, "missing-package"), {
    code: "NOT_FOUND",
  });
  assert.equal(await readFile(join(root, "intloom.yaml"), "utf8"), before);
  await assert.rejects(readFile(join(root, ".intloom/service.lock")), {
    code: "ENOENT",
  });
});

test("package mutations use the same exclusive lock as host startup", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  const release = await acquireServiceLock(root, randomUUID());
  try {
    for (const mutation of [
      () => addWorkflow(root, "fixture-workflow"),
      () => removeWorkflow(root, "fixture-workflow"),
    ])
      await assert.rejects(mutation(), { code: "CLI_SERVICE_BUSY" });
    assert.equal((await listInstalledWorkflows(root)).installation, "empty");
  } finally {
    await release();
  }
});

test("management rejects ambiguous YAML and symlink configuration without overwriting user files", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  const file = join(root, "intloom.yaml");
  const original = "workflows: []\nworkflows: []\n";
  await writeFile(file, original);
  await assert.rejects(listInstalledWorkflows(root), {
    code: "INVALID_REQUEST",
  });
  assert.equal(await readFile(file, "utf8"), original);
  await unlink(file);
  const target = join(root, "user.yaml");
  await writeFile(target, "workflows: []\n");
  await symlink(target, file);
  await assert.rejects(removeWorkflow(root, "missing"), {
    code: "CLI_PROJECT_INVALID",
  });
  assert.equal(await readFile(target, "utf8"), "workflows: []\n");
});

test("a configuration publication failure restores the prior installation", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  const old = join(root, ".intloom/workflows/user-marker");
  await writeFile(old, "original installation");
  await assert.rejects(
    buildInstallation(root, [], [], async () => {
      throw new Error("publication failed");
    }),
    /publication failed/,
  );
  assert.equal(await readFile(old, "utf8"), "original installation");
  assert.deepEqual(await readdir(join(root, ".intloom")), ["workflows"]);
});
