import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileLoom,
  checkLoom,
  inspectLoom,
  scaffoldLoom,
} from "@intloom/compiler";
import {
  validateCompiledLoom,
  compiledLoomProtocolVersion,
} from "@intloom/loom-sdk/compiled";
import { snapshot, assertClean } from "./helpers/workspace.ts";

for (const template of ["code", "agent"] as const)
  test(`builds a minimal ${template} package without package.json or tsconfig`, async (t) => {
    const parent = await mkdtemp(resolve(tmpdir(), "intloom-new-"));
    t.after(() => rm(parent, { recursive: true, force: true }));
    const root = resolve(parent, "sample");
    await scaffoldLoom(root, template);
    const inspected = await inspectLoom(root);
    assert.equal(inspected.definition.name, "sample");
    await assert.rejects(scaffoldLoom(root, template), {
      code: "INVALID_BUILD_CONFIG",
    });
    await checkLoom({ packageRoot: root });
    await assert.rejects(readFile(resolve(root, "dist/package.json")), {
      code: "ENOENT",
    });
    const result = await compileLoom({ packageRoot: root });
    assert.equal(result.loomName, "sample");
    const metadata = JSON.parse(
      await readFile(resolve(root, "dist/package.json"), "utf8"),
    );
    assert.equal(metadata.loom.version, compiledLoomProtocolVersion);
    const module = await import(
      pathToFileURL(resolve(root, "dist/loom.generated.js")).href
    );
    const compiled = validateCompiledLoom(module);
    assert.deepEqual(Object.keys(module).sort(), [
      "bindings",
      "definition",
      "plan",
    ]);
    if (template === "code")
      assert.equal(
        await Object.values(compiled.bindings.codes)[0]?.(
          " hello " as never,
          {} as never,
        ),
        "hello",
      );
    else
      assert.equal(compiled.definition.agents.worker?.modelProfile, "standard");
    const before = await snapshot(resolve(root, "dist"));
    await compileLoom({ packageRoot: root });
    assert.deepEqual(await snapshot(resolve(root, "dist")), before);
    await checkLoom({ packageRoot: root });
    assert.deepEqual(await snapshot(resolve(root, "dist")), before);
    await assertClean(root);
  });

test("links schema references, checks and confirmation; a failed check build preserves the last dist", async (t) => {
  const parent = await mkdtemp(resolve(tmpdir(), "intloom-new-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = resolve(parent, "sample");
  await scaffoldLoom(root);
  await mkdir(resolve(root, "schemas"));
  await writeFile(
    resolve(root, "schemas/text.json"),
    JSON.stringify({ type: "string", minLength: 1 }),
  );
  const yaml = (await readFile(resolve(root, "loom.yaml"), "utf8")).replace(
    "input:\n  type: string\n  minLength: 1",
    "input:\n  $ref: ./schemas/text.json",
  );
  await writeFile(
    resolve(root, "loom.yaml"),
    `${yaml}\ninteractions:\n  approve:\n    kind: confirm\n    title: Approve\n    context:\n      $ref: ./schemas/text.json\nacceptance:\n  checks:\n    - id: valid\n      code: ./code/check.ts#check\n  confirmation: approve\n`,
  );
  await writeFile(
    resolve(root, "code/check.ts"),
    "export const check = () => ({ passed: true });",
  );
  await compileLoom({ packageRoot: root });
  const original = await snapshot(resolve(root, "dist"));
  const inspected = await inspectLoom(root);
  assert.deepEqual(
    inspected.plan.steps.map((s) => s.kind),
    ["code", "output", "check", "confirm", "deliver"],
  );
  await writeFile(
    resolve(root, "code/check.ts"),
    'export const check = () => "not a check report";',
  );
  await assert.rejects(checkLoom({ packageRoot: root }), {
    code: "TYPESCRIPT_FAILED",
  });
  assert.deepEqual(await snapshot(resolve(root, "dist")), original);
  await assertClean(root);
});

test("static compilation never evaluates author modules and reports source contract errors", async (t) => {
  const parent = await mkdtemp(resolve(tmpdir(), "intloom-new-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = resolve(parent, "sample");
  await scaffoldLoom(root);
  await writeFile(
    resolve(root, "code/run.ts"),
    'throw new Error("AUTHOR_MODULE_EXECUTED"); export const run = (input: string) => input;',
  );
  await compileLoom({ packageRoot: root });
  const yaml = await readFile(resolve(root, "loom.yaml"), "utf8");
  for (const suffix of [
    "\npresentation:\n  result:\n    app: missing\n",
    "\nacceptance:\n  confirmation: missing\n",
  ]) {
    await writeFile(resolve(root, "loom.yaml"), yaml + suffix);
    await assert.rejects(compileLoom({ packageRoot: root }), {
      code: "INVALID_LOOM",
    });
  }
  await writeFile(
    resolve(root, "loom.yaml"),
    yaml.replace("type: string", "type: string\n  unsupportedConstraint: true"),
  );
  await assert.rejects(compileLoom({ packageRoot: root }), {
    code: "INVALID_LOOM",
  });
});

test("workflow links sequential Code data and rejects forward references", async (t) => {
  const parent = await mkdtemp(resolve(tmpdir(), "intloom-new-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = resolve(parent, "sample");
  await scaffoldLoom(root);
  const yaml = (await readFile(resolve(root, "loom.yaml"), "utf8")).replace(
    "code: ./code/run.ts#run",
    "workflow: ./workflow.yaml",
  );
  await writeFile(resolve(root, "loom.yaml"), yaml);
  const workflow =
    "steps:\n  - id: first\n    execute:\n      code: ./code/run.ts#run\n  - id: second\n    execute:\n      code: ./code/run.ts#run\n    input:\n      from: first\noutput:\n  from: second\n";
  await writeFile(resolve(root, "workflow.yaml"), workflow);
  await compileLoom({ packageRoot: root });
  await writeFile(
    resolve(root, "workflow.yaml"),
    workflow.replace("from: first", "from: missing"),
  );
  await assert.rejects(compileLoom({ packageRoot: root }), {
    code: "INVALID_LOOM",
  });
});
