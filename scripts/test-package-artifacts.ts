import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  copyPackageTestWorkspace,
  packageTestArtifactPaths,
} from "./package-test-artifacts.ts";
import { repositoryRoot } from "./publication.ts";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
};
delete env.NODE_TEST_CONTEXT;
delete env.NODE_OPTIONS;
delete env.NODE_PATH;

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== "--clean"))
  throw new Error("Usage: node scripts/test-package-artifacts.ts [--clean]");
const artifacts = await packageTestArtifactPaths();
if (args[0] === "--clean") {
  const temporary = await mkdtemp(
    resolve(tmpdir(), "intloom-package-artifacts-"),
  );
  try {
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    )
      .split("\0")
      .filter(Boolean);
    const existing = [];
    for (const file of files) {
      try {
        await stat(resolve(repositoryRoot, file));
        existing.push(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await copyPackageTestWorkspace(
      repositoryRoot,
      temporary,
      existing,
      artifacts,
    );
    console.log(`Testing transferred package artifacts in ${temporary}`);
    process.exitCode = run("bun", ["install", "--frozen-lockfile"], temporary);
    if (!process.exitCode)
      process.exitCode = run(
        process.execPath,
        ["scripts/test-package-artifacts.ts"],
        temporary,
      );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
} else {
  const tests: string[] = [];
  for (const parent of ["apps", "packages"]) {
    for (const workspace of await readdir(resolve(repositoryRoot, parent), {
      withFileTypes: true,
    })) {
      if (!workspace.isDirectory()) continue;
      const directory = resolve(
        repositoryRoot,
        parent,
        workspace.name,
        "test/package",
      );
      try {
        for (const entry of await readdir(directory, { withFileTypes: true }))
          if (entry.isFile() && entry.name.endsWith(".intg.ts"))
            tests.push(resolve(directory, entry.name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  if (!tests.length) throw new Error("No package artifact tests found.");
  process.exitCode = run(
    process.execPath,
    ["--test", ...tests.sort()],
    repositoryRoot,
  );
}
