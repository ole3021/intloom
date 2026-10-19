import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { test } from "node:test";
import { repositoryRoot } from "./publication.ts";

test("the resolved task graph builds dependencies and archives before uncached verification", async () => {
  const require = createRequire(import.meta.url);
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      require.resolve("turbo/bin/turbo"),
      "run",
      "typecheck",
      "test",
      "test:intg",
      "test:package",
      "--dry=json",
    ],
    { cwd: repositoryRoot, maxBuffer: 8 * 1024 * 1024, timeout: 30_000 },
  );
  const graph = JSON.parse(stdout) as {
    tasks: {
      taskId: string;
      command: string;
      dependencies: string[];
      outputs: string[] | null;
      resolvedTaskDefinition: { cache: boolean };
    }[];
  };
  function task(id: string) {
    const result = graph.tasks.find((entry) => entry.taskId === id);
    assert.ok(result, `Missing task ${id}`);
    return result;
  }
  for (const name of [
    "@intloom/cli",
    "@intloom/kernel",
    "@intloom/compiler",
    "@intloom/loom-sdk",
  ]) {
    const unit = task(`${name}#test`);
    assert.ok(!unit.dependencies.includes(`${name}#build`));
    if (name !== "@intloom/loom-sdk")
      assert.ok(unit.dependencies.includes("@intloom/loom-sdk#build"));
  }
  assert.deepEqual(task("@intloom/utils#test").dependencies, []);
  assert.ok(
    task("@intloom/intent#typecheck").dependencies.includes(
      "@intloom/intent#build",
    ),
  );
  for (const suffix of ["build", "typecheck"])
    for (const name of ["kernel", "compiler", "loom-sdk", "utils"])
      assert.ok(
        task(`@intloom/cli#${suffix}`).dependencies.includes(
          `@intloom/${name}#build`,
        ),
      );
  assert.deepEqual(task("@intloom/cli#build").outputs?.sort(), [
    ".publish-intloom/**",
    ".publish/**",
    "dist/**",
  ]);
  for (const item of graph.tasks) {
    const kind = item.taskId.split("#")[1];
    if (["test", "test:intg", "test:package", "pack"].includes(kind ?? ""))
      assert.equal(item.resolvedTaskDefinition.cache, false, item.taskId);
    if (kind === "test:intg" && item.command !== "<NONEXISTENT>")
      assert.ok(
        item.dependencies.includes(
          item.taskId.replace(/#test:intg$/, "#build"),
        ),
        item.taskId,
      );
    if (kind === "test:package" && item.command !== "<NONEXISTENT>")
      assert.ok(
        item.dependencies.includes(
          item.taskId.replace(/#test:package$/, "#pack"),
        ),
        item.taskId,
      );
  }
  assert.ok(
    task("@intloom/intent#test:package").dependencies.includes(
      "@intloom/cli#pack",
    ),
  );
  assert.ok(
    task("@intloom/cli#test:package").dependencies.includes(
      "@intloom/compiler#pack",
    ),
  );
});
