import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { compileLoom, type CompilerDiagnostic } from "@intloom/compiler";
import { LoomError } from "@intloom/utils";
import {
  workspace,
  snapshot,
  assertClean,
  replace,
} from "./helpers/workspace.ts";
import { editStage } from "./helpers/definition.ts";

for (const [file, source] of [
  ["codes/run.ts", "export default () => 42;"],
  ["codes/run.ts", "export default (value: string) => ({ outcome: value });"],
  [
    "codes/run.ts",
    'export default Object.assign(() => ({ outcome: "complete" }), { recover: () => 42 });',
  ],
  ["initializers/state.ts", "export default () => new Date();"],
  ["schemas/state.ts", 'import * as z from "zod"; export default z.date();'],
  ["schemas/result.ts", 'import * as z from "zod"; export default z.date();'],
  ["schemas/result.ts", 'import * as z from "zod"; export default z.string();'],
  [
    "schemas/result.ts",
    'import * as z from "zod"; export default z.strictObject({ status: z.string() });',
  ],
] as const)
  test(`enforces the SDK contract for ${file}: ${source}`, async (t) => {
    const { root } = await workspace(t);
    await writeFile(resolve(root, file), source);
    await assert.rejects(compileLoom({ packageRoot: root }), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "TYPESCRIPT_FAILED");
      const diagnostics = (error.cause as { diagnostics: CompilerDiagnostic[] })
        .diagnostics;
      assert.ok(
        diagnostics.some(
          (d) =>
            d.location?.file.endsWith("stages/first.yaml") &&
            d.related?.some((at) => at.file === resolve(root, file)),
        ),
      );
      return true;
    });
    await assertClean(root);
  });

test("builds reproducibly and emits only the entry dependency graph", async (t) => {
  const { root } = await workspace(t);
  await writeFile(resolve(root, "unused.ts"), "const invalid: string = 42;");
  await compileLoom({ packageRoot: root });
  const first = await snapshot(resolve(root, "dist"));
  await compileLoom({ packageRoot: root });
  assert.deepEqual(await snapshot(resolve(root, "dist")), first);
  assert.equal(first["unused.js"], undefined);
  assert.ok(Object.keys(first).every((f) => !f.includes(".intloom-build-")));
  for (const [file, content] of Object.entries(first))
    if (file.endsWith(".map"))
      assert.doesNotMatch(
        Buffer.from(content, "base64").toString(),
        /\.intloom-build-/,
      );
  await assertClean(root);
});

test("compiles Code, Schema, initializer and Tool through barrel exports", async (t) => {
  const { root } = await workspace(t);
  await writeFile(
    resolve(root, "barrel.ts"),
    [
      'export { default as run } from "./codes/run.ts";',
      'export { default as state } from "./schemas/state.ts";',
      'export { default as initialize } from "./initializers/state.ts";',
      'export * from "./tools/echo.ts";',
    ].join("\n"),
  );
  await editStage(root, "first", (stage) => {
    stage.state.schema = "../barrel.ts#state";
    stage.state.initialize = "../barrel.ts#initialize";
    const run = stage.steps.run;
    assert.ok(run?.type === "code");
    run.code = "../barrel.ts#run";
    const review = stage.steps.review;
    assert.ok(review?.type === "agent");
    review.tools = ["../barrel.ts#echoTool"];
  });
  await compileLoom({ packageRoot: root });
  assert.ok((await snapshot(resolve(root, "dist")))["barrel.js"]);
});

test("returns located reachability warnings while completing a valid build", async (t) => {
  const { root } = await workspace(t);
  await editStage(root, "first", (stage) => {
    const run = stage.steps.run;
    assert.ok(run);
    stage.steps.unused = structuredClone(run);
  });
  const result = await compileLoom({ packageRoot: root });
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0]?.code, "UNREACHABLE_STEP");
  assert.equal(result.diagnostics[0]?.location?.stepName, "unused");
  assert.ok(result.diagnostics[0]?.location?.line);
});

test("rejects declarations that depend on a dev-only package", async (t) => {
  const { root } = await workspace(t);
  await mkdir(resolve(root, "node_modules/dev-only"), { recursive: true });
  await writeFile(
    resolve(root, "node_modules/dev-only/package.json"),
    '{"name":"dev-only","version":"1.0.0","types":"index.d.ts"}',
  );
  await writeFile(
    resolve(root, "node_modules/dev-only/index.d.ts"),
    "export interface Extra { value: string }",
  );
  await replace(
    root,
    "codes/run.ts",
    "run(access: CodeExecutionAccess<JsonValue>)",
    'run(access: CodeExecutionAccess<JsonValue>, _extra?: import("dev-only").Extra)',
  );
  await assert.rejects(
    compileLoom({ packageRoot: root }),
    (error) =>
      LoomError.is(error) &&
      error.code === "INVALID_OUTPUT" &&
      /Declaration dependency is not declared: dev-only/.test(error.message),
  );
});

test("author TypeScript settings cannot disable SDK contract checks", async (t) => {
  const { root } = await workspace(t);
  const config = JSON.parse(
    await readFile(resolve(root, "tsconfig.build.json"), "utf8"),
  );
  config.compilerOptions = {
    ...config.compilerOptions,
    strict: false,
    strictFunctionTypes: false,
    strictNullChecks: false,
    noCheck: true,
  };
  await writeFile(resolve(root, "tsconfig.build.json"), JSON.stringify(config));
  await writeFile(
    resolve(root, "codes/run.ts"),
    "export default (value: string) => ({ outcome: value });",
  );
  await assert.rejects(
    compileLoom({ packageRoot: root }),
    (error) => LoomError.is(error) && error.code === "TYPESCRIPT_FAILED",
  );
});

test("shared Code diagnostics retain the declaring Step instead of the last reference", async (t) => {
  const { root } = await workspace(t);
  await editStage(root, "first", (stage) => {
    const run = stage.steps.run;
    assert.ok(run);
    stage.steps.unused = structuredClone(run);
  });
  await writeFile(resolve(root, "codes/run.ts"), "export default () => 42;");
  await assert.rejects(compileLoom({ packageRoot: root }), (error) => {
    assert.ok(LoomError.is(error));
    const diagnostics = (error.cause as { diagnostics: CompilerDiagnostic[] })
      .diagnostics;
    assert.equal(diagnostics[0]?.location?.stepName, "run");
    return true;
  });
});
