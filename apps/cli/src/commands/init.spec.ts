import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryDirectory } from "../../test/directory-fixture.ts";
import { initProject } from "./init.ts";

test("creates a language-neutral scaffold in a new nested or existing empty directory", async (t) => {
  const temporary = await temporaryDirectory(t);
  for (const root of [temporary, join(temporary, "new", "项目 with spaces")]) {
    assert.deepEqual(await initProject(root), {
      projectRoot: root,
      status: "scaffolded",
    });
    assert.deepEqual((await readdir(root)).sort(), [
      ".gitignore",
      ".intloom",
      "intloom",
      "intloom.yaml",
    ]);
    assert.deepEqual((await readdir(join(root, "intloom"))).sort(), [
      "artifacts",
      "project",
      "records",
    ]);
    for (const path of [
      "intloom/project",
      "intloom/artifacts",
      "intloom/records",
      ".intloom/workflows",
    ])
      assert.deepEqual(await readdir(join(root, path)), []);
    assert.match(
      await readFile(join(root, "intloom.yaml"), "utf8"),
      /^workflows: \[\]$/mu,
    );
    assert.equal(
      await readFile(join(root, ".gitignore"), "utf8"),
      "/.intloom/\n/intloom/store.lock\n",
    );
    if (process.platform !== "win32")
      assert.equal((await lstat(join(root, ".intloom"))).mode & 0o077, 0);
  }
});

test("repeat initialization preserves edited configuration and project assets", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  await writeFile(
    join(root, "intloom.yaml"),
    "# User configuration\nworkflows: []\n",
  );
  await writeFile(
    join(root, "intloom/project/knowledge.txt"),
    "Project knowledge",
  );
  await assert.rejects(initProject(root), {
    code: "CLI_INIT_TARGET_NOT_EMPTY",
  });
  assert.equal(
    await readFile(join(root, "intloom.yaml"), "utf8"),
    "# User configuration\nworkflows: []\n",
  );
  assert.equal(
    await readFile(join(root, "intloom/project/knowledge.txt"), "utf8"),
    "Project knowledge",
  );
});

test("rejects existing content, including retired configuration and dangling links, before adding files", async (t) => {
  const temporary = await temporaryDirectory(t);
  for (const name of [
    "README.md",
    ".gitignore",
    "intloom.config.yaml",
    ".intloom",
  ]) {
    const root = join(temporary, name);
    await mkdir(root);
    if (name === ".intloom")
      await symlink(join(root, "missing"), join(root, name), "junction");
    else await writeFile(join(root, name), "Existing content");
    await assert.rejects(initProject(root), {
      code: "CLI_INIT_TARGET_NOT_EMPTY",
    });
    assert.deepEqual(await readdir(root), [name]);
    if (name !== ".intloom")
      assert.equal(
        await readFile(join(root, name), "utf8"),
        "Existing content",
      );
  }
});

test("rejects file and symlink targets without writing through the link", async (t) => {
  const temporary = await temporaryDirectory(t);
  const target = join(temporary, "target");
  const alias = join(temporary, "alias");
  const file = join(temporary, "file");
  await mkdir(target);
  await symlink(target, alias, "junction");
  await writeFile(file, "Keep this file");
  for (const path of [file, alias])
    await assert.rejects(initProject(path), {
      code: "CLI_INIT_TARGET_INVALID",
    });
  assert.deepEqual(await readdir(target), []);
  assert.equal(await readFile(file, "utf8"), "Keep this file");
  await assert.rejects(initProject("  "), { code: "INVALID_REQUEST" });
});

test("competing initializations leave one complete scaffold", async (t) => {
  const root = await temporaryDirectory(t);
  const results = await Promise.allSettled([
    initProject(root),
    initProject(root),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.ok(
    (await readFile(join(root, "intloom.yaml"), "utf8")).includes(
      "workflows: []",
    ),
  );
  assert.equal(
    await readFile(join(root, ".gitignore"), "utf8"),
    "/.intloom/\n/intloom/store.lock\n",
  );
  assert.ok((await lstat(join(root, "intloom/records"))).isDirectory());
});
