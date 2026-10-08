import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { configText, projectFixture } from "../../test/project-fixture.ts";
import { testConfig } from "../../test/agent-fixture.ts";
import { loadConfig } from "./load-config.ts";
import { checkProject } from "./check-project.ts";

test("intloom.yaml identifies language-neutral projects and normalizes omitted storage and workflows", async (t) => {
  const project = await projectFixture(t);
  await writeFile(resolve(project.root, "intloom.yaml"), configText);
  const checked = await checkProject(project.root);
  assert.equal(checked.config.localStorage, "file");
  assert.deepEqual(checked.config.workflows, []);
  const dependency = {
    name: "@example/intent",
    version: "1.2.3",
    sha256: "a".repeat(64),
  };
  for (const extra of [
    { localStorage: "remote" },
    { workflows: [dependency, dependency] },
    { workflows: [{ ...dependency, version: "latest" }] },
    { workflows: [{ ...dependency, sha256: "unverified" }] },
  ]) {
    await writeFile(
      resolve(project.root, "intloom.yaml"),
      JSON.stringify({ ...testConfig(), ...extra }),
    );
    await assert.rejects(loadConfig(project.root), { code: "INVALID_REQUEST" });
  }
});

test("rejects roots that only contain the retired configuration format", async (t) => {
  const project = await projectFixture(t);
  await rm(resolve(project.root, "intloom.yaml"));
  await writeFile(resolve(project.root, "package.json"), '{"type":"module"}');
  await writeFile(resolve(project.root, "intloom.config.yaml"), configText);
  await assert.rejects(checkProject(project.root), { code: "NOT_FOUND" });
  await assert.rejects(loadConfig(project.root), { code: "NOT_FOUND" });
});

test("loads the fixed config entry, applies Schema parsing, and does not resolve credentials or rewrite files", async (t) => {
  const project = await projectFixture(t);
  const file = resolve(project.root, "intloom.yaml");
  const text = configText.replace(
    "model: test-model",
    'model: "  test-model  "',
  );
  await writeFile(file, text);
  assert.deepEqual(await loadConfig(project.root), testConfig());
  assert.equal(await readFile(file, "utf8"), text);
});

test("reports a missing fixed config without searching a parent or silently generating defaults", async (t) => {
  const project = await projectFixture(t);
  const nested = resolve(project.root, "nested");
  await mkdir(nested);
  await assert.rejects(loadConfig(nested), { code: "NOT_FOUND" });
  await assert.rejects(readFile(resolve(nested, "intloom.yaml")), {
    code: "ENOENT",
  });
});

test("rejects malformed, duplicate, aliased, tagged, multiple-document and Schema-invalid configs", async (t) => {
  const project = await projectFixture(t);
  for (const text of [
    "llms: [unterminated",
    `${configText}\nintent: { apps: [] }\n`,
    configText.replace("apps: []", "apps: &apps []\n  copied: *apps"),
    configText.replace("test-model", "!custom test-model"),
    `${configText}\n---\n${configText}`,
    "[]",
    configText.replace("default:", "Default:"),
    configText.replace("ENV.INTLOOM_WORKFLOW_TEST_KEY", "plain-credential"),
  ]) {
    await writeFile(resolve(project.root, "intloom.yaml"), text);
    await assert.rejects(loadConfig(project.root), (cause: unknown) => {
      assert.ok(cause instanceof Error && "code" in cause);
      assert.equal(cause.code, "INVALID_REQUEST");
      assert.ok(cause.cause instanceof Error);
      assert.equal(cause.message.includes("plain-credential"), false);
      return true;
    });
  }
});

test("configuration IO failures remain separate from content validation errors", async (t) => {
  const project = await projectFixture(t);
  const file = resolve(project.root, "intloom.yaml");
  await rm(file);
  await mkdir(file);
  await assert.rejects(loadConfig(project.root), {
    code: "KERNEL_UNAVAILABLE",
  });
});
