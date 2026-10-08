import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { glob, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = promisify(execFile);
const workspaces = new Map<
  string,
  {
    directory: string;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    exports?: unknown;
  }
>();
for await (const file of glob(
  ["apps/*/package.json", "packages/*/package.json"],
  {
    cwd: root,
  },
)) {
  const directory = dirname(resolve(root, file));
  const manifest = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  workspaces.set(manifest.name, {
    directory,
    scripts: manifest.scripts ?? {},
    dependencies: {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    },
    exports: manifest.exports,
  });
}

interface Task {
  taskId: string;
  dependencies: string[];
  resolvedTaskDefinition: { outputs: string[]; cache: boolean };
}

for (const command of ["build", "typecheck", "test", "test:intg", "pack"]) {
  test(`${command}: resolved task graph preserves build prerequisites and outputs`, async () => {
    const { stdout } = await run(
      resolve(root, "node_modules/.bin/turbo"),
      ["run", command, "--dry=json"],
      { cwd: root, maxBuffer: 8 * 1024 * 1024 },
    );
    const graph = JSON.parse(stdout) as { tasks: Task[] };
    const tasks = new Map(graph.tasks.map((task) => [task.taskId, task]));
    function prerequisites(id: string): Set<string> {
      const result = new Set<string>();
      function visit(current: string) {
        for (const dependency of tasks.get(current)?.dependencies ?? []) {
          if (result.has(dependency)) continue;
          result.add(dependency);
          visit(dependency);
        }
      }
      visit(id);
      return result;
    }
    for (const [name, workspace] of workspaces) {
      if (!workspace.scripts[command]) continue;
      const id = `${name}#${command}`;
      const task = tasks.get(id);
      assert.ok(task, `Missing workspace task: ${id}`);
      const required = prerequisites(id);
      for (const dependency of Object.keys(workspace.dependencies)) {
        if (!workspaces.get(dependency)?.scripts.build) continue;
        assert.ok(
          required.has(`${dependency}#build`),
          `${id} must wait for ${dependency}#build`,
        );
      }
      if (command === "typecheck" && workspace.exports) {
        const config = JSON.parse(
          await readFile(resolve(workspace.directory, "tsconfig.json"), "utf8"),
        );
        // Without a source alias, package self-imports resolve generated declarations.
        if (!config.compilerOptions?.paths?.[name]) {
          assert.ok(
            required.has(`${name}#build`),
            `${id} must wait for its build`,
          );
        }
      }
      if (command === "test:intg" || command === "pack") {
        assert.ok(
          required.has(`${name}#build`),
          `${id} must wait for its build`,
        );
        assert.equal(
          task.resolvedTaskDefinition.cache,
          false,
          `${id} must run`,
        );
      }
      // CLI source tests share a fixture that imports the built public CLI entry.
      if (command === "test" && name === "@intloom/cli") {
        assert.ok(
          required.has(`${name}#build`),
          `${id} must wait for its shared fixture's build`,
        );
      }
      if (command === "build") {
        assert.ok(
          task.resolvedTaskDefinition.outputs.includes("dist/**"),
          `${id} must restore dist from cache`,
        );
        if (name === "@intloom/cli") {
          for (const output of [".publish/**", ".publish-intloom/**"]) {
            assert.ok(
              task.resolvedTaskDefinition.outputs.includes(output),
              `${id} must restore ${output} from cache`,
            );
          }
        }
      }
    }
  });
}
