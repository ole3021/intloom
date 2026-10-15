import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { workspace } from "../../test/helpers/workspace.ts";
import { editManifest, editStage } from "../../test/helpers/definition.ts";
import { loadSources } from "../load/load-sources.ts";
import { analyzeLoom } from "./analyze-loom.ts";

const analyze = async (root: string) =>
  analyzeLoom(await loadSources({ packageRoot: root }));

test("links normalized routes, shares resources and produces stable IDs across source roots", async (t) => {
  const a = await workspace(t);
  const b = await workspace(t);
  const first = await analyze(a.root);
  const second = await analyze(b.root);
  assert.equal(first.model.loomName, "compiler_fixture");
  assert.deepEqual(first.codeIds, second.codeIds);
  assert.deepEqual(first.agentIds, second.agentIds);
  assert.equal(Object.keys(first.codeIds).length, 1);
  assert.equal(Object.keys(first.agentIds).length, 1);
  assert.deepEqual(first.model.stages.first?.on, {
    complete: { kind: "stage", stageName: "second" },
  });
  assert.deepEqual(first.model.stages.second?.on, {
    complete: { kind: "loom_end" },
  });
  assert.deepEqual(first.diagnostics, []);
  for (const id of Object.values(first.codeIds))
    assert.match(id, /^CODE-[\w-]{21}$/);
});

for (const variation of ["same", "llm", "schema", "tools", "skills"] as const) {
  test(`Agent binding identity includes ${variation}`, async (t) => {
    const { root } = await workspace(t);
    await editStage(root, "first", (stage) => {
      const original = stage.steps.review;
      assert.ok(original?.type === "agent");
      const changed = structuredClone(original);
      if (variation === "llm") changed.llm = "working";
      if (variation === "schema") changed.outputSchema = "../schemas/state.ts";
      if (variation === "tools") changed.tools = [];
      if (variation === "skills") changed.skills = [];
      stage.steps.other = changed;
    });
    const result = await analyze(root);
    assert.equal(
      Object.keys(result.agentIds).length,
      variation === "same" ? 1 : 2,
    );
    assert.equal(result.model.assets.length, 2);
  });
}

for (const target of [
  "entry_stage",
  "entry_step",
  "step",
  "stage",
  "outcome",
  "name",
  "empty_routes",
] as const) {
  test(`rejects invalid ${target}`, async (t) => {
    const { root } = await workspace(t);
    await editManifest(root, (manifest) => {
      const first = manifest.loom.stages.first;
      assert.ok(first);
      if (target === "entry_stage") manifest.loom.entry = "missing";
      if (target === "stage") first.on.complete = { target: "missing" };
      if (target === "outcome") first.on = {};
    });
    await editStage(root, "first", (stage) => {
      const run = stage.steps.run;
      assert.ok(run);
      if (target === "entry_step") stage.entry = "missing";
      if (target === "name") stage.name = "different";
      if (target === "step") run.on = { complete: { target: "missing" } };
      if (target === "empty_routes") run.on = {};
    });
    const sources = await loadSources({ packageRoot: root });
    assert.throws(
      () => analyzeLoom(sources),
      (error) => LoomError.is(error) && error.code === "INVALID_LOOM",
    );
  });
}

test("warns about unreachable nodes using executable exits, and accepts reachable cycles", async (t) => {
  const { root } = await workspace(t);
  await editStage(root, "first", (stage) => {
    stage.steps.unused = {
      type: "code",
      code: "../codes/run.ts",
      on: { unused_exit: { end: true } },
    };
  });
  await writeFile(
    resolve(root, "stages/unused.yaml"),
    JSON.stringify({
      stage: {
        name: "unused",
        state: {
          schema: "../schemas/state.ts",
          initialize: "../initializers/state.ts",
        },
        entry: "run",
        steps: {
          run: {
            type: "code",
            code: "../codes/run.ts",
            on: { complete: { end: true } },
          },
        },
      },
    }),
  );
  await editManifest(root, (manifest) => {
    const first = manifest.loom.stages.first;
    const second = manifest.loom.stages.second;
    assert.ok(first && second);
    first.on.unused_exit = { target: "unused" };
    manifest.loom.stages.unused = {
      stage: "./stages/unused.yaml",
      on: { complete: { end: true } },
    };
    second.on.complete = { target: "first" };
  });
  const result = await analyze(root);
  assert.deepEqual(
    result.diagnostics.map((d) => [
      d.code,
      d.location?.stageName,
      d.location?.stepName,
    ]),
    [
      ["UNREACHABLE_STEP", "first", "unused"],
      ["UNREACHABLE_STAGE", "unused", undefined],
    ],
  );
});

test("analysis uses the loaded snapshot without reading source files", async (t) => {
  const { root } = await workspace(t);
  const sources = await loadSources({ packageRoot: root });
  await writeFile(
    resolve(root, "skills/review/SKILL.md"),
    "invalid changed source",
  );
  assert.equal(
    Object.values(analyzeLoom(sources).model.agents)[0]?.skills[0]?.content,
    "Check the value using template.txt.",
  );
});

for (const field of ["package", "loom"] as const)
  test(`namespaces resource IDs by ${field} name`, async (t) => {
    const { root } = await workspace(t);
    const before = await analyze(root);
    await editManifest(root, (manifest) => {
      if (field === "package") manifest.name = "@example/another";
      else manifest.loom.name = "another";
    });
    const after = await analyze(root);
    assert.notDeepEqual(before.codeIds, after.codeIds);
    assert.notDeepEqual(before.agentIds, after.agentIds);
  });
