import assert from "node:assert/strict";
import { access, cp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { compileLoom } from "@intloom/compiler";
import { LoomError } from "@intloom/utils";
import {
  assertClean,
  replace,
  snapshot,
  workspace,
} from "./helpers/workspace.ts";

const cases: {
  name: string;
  code: string;
  mutate(root: string): Promise<void>;
  message: RegExp;
  location?: string;
}[] = [
  {
    name: "Tool without an output schema",
    code: "TYPESCRIPT_FAILED",
    mutate: (root) =>
      replace(root, "tools/echo.ts", "  outputSchema: z.string(),\n", ""),
    message: /TypeScript compilation failed/u,
  },
  {
    name: "duplicate YAML keys",
    code: "SOURCE_PARSE_FAILED",
    mutate: (root) =>
      replace(
        root,
        "stages/first.yaml",
        "  name: first",
        "  name: first\n  name: duplicate",
      ),
    message: /unique|duplicat/iu,
    location: "stages/first.yaml",
  },
  {
    name: "missing route target",
    code: "INVALID_LOOM",
    mutate: (root) =>
      replace(root, "stages/first.yaml", "target: review", "target: missing"),
    message: /Unknown target step/u,
    location: "stages/first.yaml",
  },
  {
    name: "missing Code source",
    code: "SOURCE_READ_FAILED",
    mutate: (root) => rm(resolve(root, "codes/run.ts")),
    message: /read source/u,
    location: "codes/run.ts",
  },
  {
    name: "missing Code export",
    code: "TYPESCRIPT_FAILED",
    mutate: (root) =>
      writeFile(resolve(root, "codes/run.ts"), "export const other = () => 1;"),
    message: /default/u,
  },
  {
    name: "non-callable Code",
    code: "TYPESCRIPT_FAILED",
    mutate: (root) =>
      writeFile(resolve(root, "codes/run.ts"), "export default 42;"),
    message: /TypeScript compilation failed/u,
  },
  {
    name: "missing Stage initializer field",
    code: "INVALID_LOOM",
    mutate: (root) =>
      replace(
        root,
        "stages/first.yaml",
        '    initialize: "../initializers/state.ts"\n',
        "",
      ),
    message: /Invalid/,
    location: "stages/first.yaml",
  },
  {
    name: "missing initializer source",
    code: "SOURCE_READ_FAILED",
    mutate: (root) => rm(resolve(root, "initializers/state.ts")),
    message: /read source/u,
    location: "initializers/state.ts",
  },
  {
    name: "non-callable initializer",
    code: "TYPESCRIPT_FAILED",
    mutate: (root) =>
      writeFile(resolve(root, "initializers/state.ts"), "export default 42;"),
    message: /TypeScript compilation failed/u,
  },
  {
    name: "erased initializer export",
    code: "INVALID_OUTPUT",
    mutate: (root) =>
      writeFile(
        resolve(root, "initializers/state.ts"),
        "declare function seed(): {}; export default seed;",
      ),
    message: /no runtime binding/u,
  },
  {
    name: "undeclared runtime dependency",
    code: "INVALID_OUTPUT",
    mutate: async (root) => {
      const file = resolve(root, "package.json");
      const manifest = JSON.parse(await readFile(file, "utf8"));
      delete manifest.dependencies.zod;
      await writeFile(file, JSON.stringify(manifest));
    },
    message: /(Runtime|Declaration) dependency is not declared: zod/u,
  },
  {
    name: "erased runtime export",
    code: "INVALID_OUTPUT",
    mutate: (root) =>
      writeFile(
        resolve(root, "codes/run.ts"),
        "declare function run(): { outcome: string }; export default run;",
      ),
    message: /no runtime binding/u,
  },
];

test("failed compilation preserves the published output", async (suite) => {
  const { root: baseline } = await workspace(suite);
  await compileLoom({ packageRoot: baseline });
  const previous = await snapshot(resolve(baseline, "dist"));

  for (const scenario of cases)
    await suite.test(
      `rejects ${scenario.name} and preserves a previous successful build`,
      async (t) => {
        const { root } = await workspace(t);
        await cp(resolve(baseline, "dist"), resolve(root, "dist"), {
          recursive: true,
        });
        await scenario.mutate(root);
        await assert.rejects(compileLoom({ packageRoot: root }), (error) => {
          assert.ok(LoomError.is(error));
          assert.equal(error.code, scenario.code);
          assert.match(error.message, scenario.message);
          if (scenario.location) {
            assert.ok(
              error.cause &&
                typeof error.cause === "object" &&
                "location" in error.cause,
            );
            const location = error.cause.location as {
              file: string;
              line?: number;
              column?: number;
            };
            assert.equal(location.file, resolve(root, scenario.location));
            if (scenario.code !== "SOURCE_READ_FAILED") {
              assert.ok(location.line && location.line >= 1);
              assert.ok(location.column && location.column >= 1);
            }
          }
          return true;
        });
        assert.deepEqual(await snapshot(resolve(root, "dist")), previous);
        await assertClean(root);
      },
    );
});

test("never overwrites an author-owned generated entry", async (t) => {
  const { root } = await workspace(t);
  const file = resolve(root, "loom.generated.ts");
  const content = "// author-owned file\n";
  await writeFile(file, content);
  await compileLoom({ packageRoot: root });
  assert.equal(await readFile(file, "utf8"), content);
  await access(resolve(root, "dist"));
});
