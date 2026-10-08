import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";
import type { Blueprint, ExecutableCode } from "@intloom/workflow-sdk";

const packageName = "@intloom/workflow-intent";
const root = fileURLToPath(new URL("../", import.meta.url));
const run = promisify(execFile);

test("compiled Workflow exposes executable resources and excludes test files", async () => {
  assert.equal(
    import.meta.resolve(packageName),
    new URL("../dist/workflow.generated.js", import.meta.url).href,
  );
  const output = await import(packageName);
  assert.deepEqual(Object.keys(output).sort(), [
    "agentSpecs",
    "blueprint",
    "codes",
  ]);
  const blueprint: Blueprint = output.blueprint;
  const codes: Readonly<Record<string, ExecutableCode>> = output.codes;
  assert.equal(blueprint.flowName, "intent");
  const stage = blueprint.stages.specification;
  assert.ok(stage);
  assert.equal(Object.keys(stage.steps).length, 6);
  for (const step of Object.values(stage.steps)) {
    if (step.execution.kind === "code") {
      assert.match(step.execution.codeId, /^CODE-[\w-]{21}$/);
      assert.equal(typeof codes[step.execution.codeId], "function");
    }
    if (step.execution.kind === "agent") {
      assert.match(step.execution.agentId, /^AGENT-[\w-]{21}$/);
      const spec = output.agentSpecs[step.execution.agentId];
      assert.equal(spec.llm, "reasoning");
      assert.equal(spec.skills.length, 3);
      assert.equal(spec.tools.length, 2);
      assert.equal(
        spec.outputSchema.safeParse({ outcome: "ready" }).success,
        true,
      );
      for (const skill of spec.skills)
        for (const asset of skill.assets)
          assert.ok(
            (await readFile(resolve(root, "dist", asset), "utf8")).length > 0,
          );
    }
  }
  const files = await readdir(resolve(root, "dist"), { recursive: true });
  assert.equal(
    files.some((name) => /(?:\.spec\.|\.intg\.|^test\/)/u.test(name)),
    false,
  );
});

test("emitted declarations satisfy SDK Blueprint and Code contracts", async () => {
  const temporary = await mkdtemp(resolve(root, "test/.consumer-"));
  try {
    await writeFile(
      resolve(temporary, "consumer.ts"),
      'import { blueprint, codes } from "@intloom/workflow-intent";\nimport type { Blueprint, ExecutableCode } from "@intloom/workflow-sdk";\nblueprint satisfies Blueprint;\ncodes satisfies Readonly<Record<string, ExecutableCode>>;\n',
    );
    await writeFile(
      resolve(temporary, "tsconfig.json"),
      JSON.stringify({
        extends: resolve(root, "../../tsconfig.base.json"),
        compilerOptions: { noEmit: true },
        files: ["consumer.ts"],
      }),
    );
    const require = createRequire(import.meta.url);
    const tsc = resolve(
      dirname(require.resolve("typescript/package.json")),
      "bin/tsc",
    );
    try {
      await run(process.execPath, [
        tsc,
        "-p",
        resolve(temporary, "tsconfig.json"),
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
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
