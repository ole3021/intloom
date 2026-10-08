import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryDirectory } from "../../test/directory-fixture.ts";
import { initProject } from "./init.ts";
import { doctorProject } from "./doctor.ts";

test("offline doctor identifies missing setup without starting a service or claiming model readiness", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  const files = await readdir(root, { recursive: true });
  const config = await readFile(join(root, "intloom.yaml"), "utf8");
  for (const source of ["cli", "studio", "agent_ide"] as const) {
    const result = await doctorProject(root, source);
    assert.equal(result.source, source);
    assert.equal(result.status, "offline");
    assert.equal(
      result.checks.find((item) => item.name === "installation")?.status,
      "attention",
    );
    assert.equal(
      result.checks.find((item) => item.name === "execution")?.status,
      source === "agent_ide" ? "not_checked" : "attention",
    );
  }
  assert.deepEqual(await readdir(root, { recursive: true }), files);
  assert.equal(await readFile(join(root, "intloom.yaml"), "utf8"), config);
});

test("invalid configuration is a diagnostic with an actionable message and no raw secret disclosure", async (t) => {
  const root = await temporaryDirectory(t);
  await initProject(root);
  await writeFile(
    join(root, "intloom.yaml"),
    "llms: private-test-secret\nworkflows: []\n",
  );
  const result = await doctorProject(root);
  assert.equal(
    result.checks.find((item) => item.name === "configuration")?.status,
    "attention",
  );
  assert.doesNotMatch(JSON.stringify(result), /private-test-secret/);
});
