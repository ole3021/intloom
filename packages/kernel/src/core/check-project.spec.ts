import assert from "node:assert/strict";
import { mkdir, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { projectFixture } from "../../test/project-fixture.ts";
import { checkProject } from "./check-project.ts";

test("normalizes project aliases and returns validated config without loading Workflow dependencies", async (t) => {
  const project = await projectFixture(t);
  const alias = resolve(project.root, "alias");
  await symlink(project.root, alias, "dir");
  const checked = await checkProject(alias);
  assert.equal(checked.projectRoot, project.root);
  assert.equal(checked.config.llms?.default.model, "test-model");
  assert.equal("registries" in checked, false);
});

test("rejects blank, absent, file and non-file configuration entry roots", async (t) => {
  const project = await projectFixture(t);
  await assert.rejects(checkProject("  "), { code: "INVALID_REQUEST" });
  await assert.rejects(checkProject(resolve(project.root, "absent")), {
    code: "NOT_FOUND",
  });
  await assert.rejects(checkProject(resolve(project.root, "intloom.yaml")), {
    code: "INVALID_REQUEST",
  });
  await rm(resolve(project.root, "intloom.yaml"));
  await assert.rejects(checkProject(project.root), { code: "NOT_FOUND" });
  await mkdir(resolve(project.root, "intloom.yaml"));
  await assert.rejects(checkProject(project.root), { code: "INVALID_REQUEST" });
});
