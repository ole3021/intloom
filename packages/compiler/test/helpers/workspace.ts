import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
export const run = promisify(execFile);
export const tsc = resolve(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);
export const baseConfig = fileURLToPath(
  new URL("../../../../tsconfig.base.json", import.meta.url),
);

export async function workspace(t: TestContext) {
  const directory = await realpath(
    await mkdtemp(resolve(tmpdir(), "intloom-compiler-")),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = resolve(directory, "workflow");
  const consumer = resolve(directory, "consumer");
  await cp(
    fileURLToPath(new URL("../fixtures/workflow/", import.meta.url)),
    root,
    { recursive: true },
  );
  const config = JSON.parse(
    await readFile(resolve(root, "tsconfig.build.json"), "utf8"),
  );
  config.extends = baseConfig;
  await writeFile(resolve(root, "tsconfig.build.json"), JSON.stringify(config));
  await mkdir(resolve(directory, "node_modules/@types"), { recursive: true });
  for (const name of ["zod", "@types/node"]) {
    await symlink(
      dirname(require.resolve(`${name}/package.json`)),
      resolve(directory, "node_modules", name),
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  await mkdir(resolve(directory, "node_modules/@intloom"), { recursive: true });
  await symlink(
    fileURLToPath(new URL("../../../workflow-sdk/", import.meta.url)),
    resolve(directory, "node_modules/@intloom/workflow-sdk"),
    "dir",
  );
  await mkdir(resolve(consumer, "node_modules/@intloom"), { recursive: true });
  await symlink(
    root,
    resolve(consumer, "node_modules/@intloom/compiler-fixture"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await writeFile(resolve(consumer, "package.json"), '{"type":"module"}');
  return { root, consumer };
}

export async function snapshot(
  directory: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(relative = "") {
    for (const entry of await readdir(resolve(directory, relative), {
      withFileTypes: true,
    })) {
      const key = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(key);
      else
        result[key] = (await readFile(resolve(directory, key))).toString(
          "base64",
        );
    }
  }
  await visit();
  return result;
}
export async function assertClean(root: string) {
  const entries = await readdir(root);
  assert.equal(entries.includes("workflow.generated.ts"), false);
  assert.equal(
    entries.some((name) => name.startsWith(".intloom-build-")),
    false,
  );
}
export async function replace(
  root: string,
  file: string,
  before: string,
  after: string,
) {
  const path = resolve(root, file);
  const content = await readFile(path, "utf8");
  assert.ok(content.includes(before), `Missing mutation target in ${file}`);
  await writeFile(path, content.replace(before, after));
}
