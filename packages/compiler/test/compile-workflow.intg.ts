import assert from "node:assert/strict";
import fs, {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compileWorkflow } from "@intloom/compiler";
import { LoomError } from "@intloom/utils";
import {
  assertClean,
  baseConfig,
  run,
  snapshot,
  tsc,
  workspace,
} from "./helpers/workspace.ts";

test("compiles a complete Workflow and consumes its ESM and declarations", async (t) => {
  const { root, consumer } = await workspace(t);
  for (const file of [
    "codes/excluded.spec.ts",
    "codes/excluded.intg.ts",
    "test/excluded.ts",
  ]) {
    await mkdir(dirname(resolve(root, file)), { recursive: true });
    await writeFile(resolve(root, file), "const mustBeExcluded: string = 123;");
  }
  assert.equal(await compileWorkflow({ packageRoot: root }), undefined);
  await assertClean(root);
  for (const marker of [
    "module-loaded.txt",
    "../module-loaded.txt",
    "stage-initialized.txt",
    "../stage-initialized.txt",
  ]) {
    await assert.rejects(access(resolve(root, marker)), { code: "ENOENT" });
  }
  const files = Object.keys(await snapshot(resolve(root, "dist")));
  for (const file of [
    "workflow.generated",
    "codes/run",
    "initializers/state",
    "schemas/state",
    "schemas/result",
    "tools/echo",
  ]) {
    for (const suffix of [".js", ".d.ts", ".js.map"])
      assert.ok(files.includes(`${file}${suffix}`));
  }
  assert.equal(
    files.some((file) => /(?:\.spec\.|\.intg\.|^test\/)/u.test(file)),
    false,
  );
  const entry = await readFile(
    resolve(root, "dist/workflow.generated.js"),
    "utf8",
  );
  assert.match(entry, /\.\/codes\/run\.js/u);
  assert.doesNotMatch(entry, /from\s+["'][^"']+\.ts["']/u);
  const map = JSON.parse(
    await readFile(resolve(root, "dist/codes/run.js.map"), "utf8"),
  );
  assert.equal(
    resolve(root, "dist/codes", map.sourceRoot ?? "", map.sources[0]),
    resolve(root, "codes/run.ts"),
  );
  assert.equal(
    map.sourcesContent[0],
    await readFile(resolve(root, "codes/run.ts"), "utf8"),
  );
  await run(process.execPath, [
    fileURLToPath(new URL("./helpers/consume-workflow.ts", import.meta.url)),
    consumer,
    root,
  ]);

  await writeFile(
    resolve(consumer, "index.ts"),
    `
import { blueprint, codes, agentSpecs } from "@intloom/compiler-fixture";
const name: "compiler_fixture" = blueprint.flowName;
const code = Object.values(codes)[0]!;
const result: Promise<{ outcome: string; value: string }> = code("hello");
const agent = Object.values(agentSpecs)[0]!;
const outcome: "complete" | "retry" = agent.outputSchema.parse({ outcome: "complete" }).outcome;
const tool = agent.tools[0]!;
const echoed: Promise<string> = tool.execute("hello");
// @ts-expect-error The emitted Code requires a string input.
code(42);
// @ts-expect-error The generated declaration exposes the actual flow name.
const wrongName: "other" = blueprint.flowName;
void [name, result, outcome, echoed, wrongName];
`,
  );
  await writeFile(
    resolve(consumer, "tsconfig.json"),
    JSON.stringify({
      extends: baseConfig,
      compilerOptions: { noEmit: true, skipLibCheck: false, paths: {} },
      files: ["index.ts"],
    }),
  );
  try {
    await run(process.execPath, [
      tsc,
      "-p",
      resolve(consumer, "tsconfig.json"),
      "--pretty",
      "false",
    ]);
  } catch (error) {
    throw new Error(
      error && typeof error === "object" && "stdout" in error
        ? String(error.stdout)
        : String(error),
      { cause: error },
    );
  }
});

test("honors an explicit tsconfigFile and replaces stale successful output", async (t) => {
  const { root } = await workspace(t);
  await writeFile(
    resolve(root, "custom.json"),
    await readFile(resolve(root, "tsconfig.build.json")),
  );
  await rm(resolve(root, "tsconfig.build.json"));
  await compileWorkflow({ packageRoot: root, tsconfigFile: "custom.json" });
  await writeFile(resolve(root, "dist/stale.txt"), "old build");
  await compileWorkflow({ packageRoot: root, tsconfigFile: "custom.json" });
  await assert.rejects(access(resolve(root, "dist/stale.txt")), {
    code: "ENOENT",
  });
  await assertClean(root);
});

for (const buildFailed of [false, true]) {
  test(`reports cleanup failure through public exports with build failure=${buildFailed}`, async (t) => {
    const { root } = await workspace(t);
    await mkdir(resolve(root, "dist"));
    await writeFile(resolve(root, "dist/previous.txt"), "previous output");
    const previous = await snapshot(resolve(root, "dist"));
    if (buildFailed) {
      await writeFile(
        resolve(root, "codes/run.ts"),
        "declare function run(value: string): string; export default run;",
      );
    }
    const remove = fs.rm;
    const cleanupError = new Error("Temporary cleanup failed");
    t.mock.method(
      fs,
      "rm",
      async (...[file, options]: Parameters<typeof fs.rm>) => {
        if (
          dirname(String(file)) === root &&
          basename(String(file)).startsWith(".intloom-build-")
        ) {
          throw cleanupError;
        }
        return remove(file, options);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(compileWorkflow({ packageRoot: root }), (error) => {
        assert.ok(LoomError.is(error));
        assert.equal(
          error.code,
          buildFailed ? "INVALID_OUTPUT" : "BUILD_FAILED",
        );
        const detail = error.cause as {
          location?: { file: string };
          cause: AggregateError;
        };
        assert.ok(detail.cause instanceof AggregateError);
        assert.equal(detail.cause.errors.at(-1), cleanupError);
        if (buildFailed) {
          assert.equal(detail.location?.file, resolve(root, "codes/run.ts"));
          const original: unknown = detail.cause.errors[0];
          assert.ok(LoomError.is(original));
          assert.equal(original.code, error.code);
          assert.equal(original.message, error.message);
        } else {
          assert.match(error.message, /output was updated/u);
        }
        return true;
      });
      const current = await snapshot(resolve(root, "dist"));
      if (buildFailed) assert.deepEqual(current, previous);
      else {
        assert.ok(current["workflow.generated.js"]);
        assert.equal(current["previous.txt"], undefined);
      }
      await assert.rejects(access(resolve(root, "workflow.generated.ts")), {
        code: "ENOENT",
      });
      assert.equal(
        (await readdir(root)).filter((name) =>
          name.startsWith(".intloom-build-"),
        ).length,
        1,
      );
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

test("retains the previous output backup when restoration and cleanup both fail", async (t) => {
  const { root } = await workspace(t);
  const destination = resolve(root, "dist");
  await mkdir(destination);
  await writeFile(resolve(destination, "previous.txt"), "previous output");
  const rename = fs.rename;
  const remove = fs.rm;
  const replacementError = new Error("Output replacement failed");
  const restorationError = new Error("Output restoration failed");
  const cleanupError = new Error("Entry cleanup failed");
  let backup: string | undefined;
  t.mock.method(
    fs,
    "rename",
    async (...[from, to]: Parameters<typeof fs.rename>) => {
      if (String(to) === destination) {
        if (basename(String(from)) === "previous-dist") {
          backup = String(from);
          throw restorationError;
        }
        throw replacementError;
      }
      return rename(from, to);
    },
  );
  t.mock.method(
    fs,
    "rm",
    async (...[file, options]: Parameters<typeof fs.rm>) => {
      if (String(file) === resolve(root, "workflow.generated.ts"))
        throw cleanupError;
      return remove(file, options);
    },
  );
  syncBuiltinESMExports();
  try {
    await assert.rejects(compileWorkflow({ packageRoot: root }), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "BUILD_FAILED");
      assert.match(error.message, /previous output is preserved/u);
      const aggregate = (error.cause as { cause: AggregateError }).cause;
      assert.ok(aggregate instanceof AggregateError);
      assert.equal(aggregate.errors[1], cleanupError);
      const original: unknown = aggregate.errors[0];
      assert.ok(LoomError.is(original));
      assert.deepEqual(
        (original.cause as { cause: AggregateError }).cause.errors,
        [replacementError, restorationError],
      );
      return true;
    });
    assert.ok(backup);
    assert.equal(
      await readFile(resolve(backup, "previous.txt"), "utf8"),
      "previous output",
    );
    await assert.rejects(access(destination), { code: "ENOENT" });
    await access(resolve(root, "workflow.generated.ts"));
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
