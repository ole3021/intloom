import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime } from "../../test/runtime.ts";
import { rawState } from "../project.ts";
import { readProject, removeProject, writeProject } from "./project.ts";

test("a newly created file requires a current read before removal without terminating the Agent", async () => {
  const f = runtime("implementation", { task: "implement" });
  const input = { path: "test/storage.test.mjs" };
  await writeProject.execute({ ...input, content: "temporary test" }, f.access);
  const before = f.value();
  const rejected = await removeProject.execute(input, f.access);
  assert.ok(
    rejected && typeof rejected === "object" && !Array.isArray(rejected),
  );
  assert.equal(rejected.saved, false);
  assert.equal(rejected.code, "INTENT_FILE_READ_REQUIRED");
  assert.equal(rejected.path, input.path);
  assert.equal(rejected.revision, rawState(f.access).revision);
  assert.ok(Array.isArray(rejected.issues));
  assert.match(String(rejected.issues[0]), /read_project_file/u);
  assert.equal(f.files[input.path], "temporary test");
  assert.deepEqual(f.value(), before);
  await readProject.execute(input, f.access);
  const revision = rawState(f.access).revision;
  const result = await removeProject.execute(input, f.access);
  assert.ok(result && typeof result === "object" && !Array.isArray(result));
  assert.equal(result.saved, true);
  assert.equal(result.revision, revision + 1);
  assert.equal(Object.hasOwn(f.files, input.path), false);
  const deletion = rawState(f.access).evidence.filter(
    (item) =>
      item.kind === "project_write" &&
      item.data &&
      typeof item.data === "object" &&
      !Array.isArray(item.data) &&
      item.data.afterDigest === null,
  );
  assert.equal(deletion.length, 1);
  assert.equal(result.operationRef, deletion[0]?.id);
});

test("a stale read cannot authorize removing changed content", async () => {
  const f = runtime("implementation", { task: "implement" });
  const input = { path: "greet.mjs" };
  await readProject.execute(input, f.access);
  f.files[input.path] = "external edit";
  const before = f.value();
  const result = await removeProject.execute(input, f.access);
  assert.ok(result && typeof result === "object" && !Array.isArray(result));
  assert.equal(result.code, "INTENT_FILE_READ_REQUIRED");
  assert.equal(result.saved, false);
  assert.equal(f.files[input.path], "external edit");
  assert.deepEqual(f.value(), before);
  await readProject.execute(input, f.access);
  await removeProject.execute(input, f.access);
  assert.equal(Object.hasOwn(f.files, input.path), false);
});

test("an absent file returns a precise unperformed result without recording a deletion", async () => {
  const f = runtime("implementation", { task: "implement" });
  const before = f.value();
  const result = await removeProject.execute({ path: "missing.mjs" }, f.access);
  assert.ok(result && typeof result === "object" && !Array.isArray(result));
  assert.equal(result.code, "INTENT_FILE_NOT_FOUND");
  assert.equal(result.saved, false);
  assert.deepEqual(f.value(), before);
  assert.deepEqual(Object.keys(f.files), ["greet.mjs"]);
});

test("removal still rejects the wrong Stage or task", async () => {
  for (const f of [
    runtime("solution"),
    runtime("implementation", { task: "observe" }),
  ]) {
    await assert.rejects(
      async () => removeProject.execute({ path: "greet.mjs" }, f.access),
      { code: "INVALID_INTENT_STAGE" },
    );
    assert.ok(Object.hasOwn(f.files, "greet.mjs"));
  }
});

test("host removal failures and persistence failures remain fatal and never repeat deletion", async () => {
  for (const phase of ["remove", "save"]) {
    const f = runtime("implementation", { task: "implement" });
    const input = { path: "greet.mjs" };
    await readProject.execute(input, f.access);
    const project = f.access.project;
    assert.ok(project);
    let removals = 0;
    const failure = new Error(`${phase} failed`);
    const access = {
      ...f.access,
      project: {
        ...project,
        remove: async (path: string) => {
          removals++;
          if (phase === "remove") throw failure;
          await project.remove(path);
        },
      },
      state: {
        ...f.access.state,
        update: async () => {
          throw failure;
        },
      },
    };
    await assert.rejects(
      async () => removeProject.execute(input, access),
      (error: unknown) => error === failure,
    );
    assert.equal(removals, 1);
    assert.equal(Object.hasOwn(f.files, input.path), phase === "remove");
    assert.equal(
      rawState(f.access).evidence.filter(
        (item) => item.kind === "project_write",
      ).length,
      0,
    );
  }
});
