import { appendFile, cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publications, repositoryRoot } from "./publication.ts";
import { archiveName, readVersions } from "./release.ts";

// Test fixtures also import workspace builds; tarballs alone are insufficient.
export const packageTestDirectories = [
  "apps/cli/.publish",
  "apps/cli/.publish-intloom",
  "packages/utils/dist",
  "packages/loom-sdk/dist",
  "packages/kernel/dist",
  "packages/compiler/dist",
  "packages/intent/dist",
] as const;

export async function packageTestArtifactPaths(root = repositoryRoot) {
  const versions = await readVersions(root);
  const archives = publications.map(
    ({ name }) => `.release/${archiveName(name, versions[name])}`,
  );
  for (const path of [...packageTestDirectories, ...archives]) {
    const file = resolve(root, path);
    try {
      const info = await stat(file);
      const directory = packageTestDirectories.some((entry) => entry === path);
      if (
        directory
          ? !info.isDirectory() || !(await readdir(file)).length
          : !info.isFile() || !info.size
      )
        throw new Error("Expected nonempty build directory or archive.");
    } catch (cause) {
      throw new Error(`Missing or empty package test artifact: ${path}`, {
        cause,
      });
    }
  }
  return [...packageTestDirectories, ...archives];
}

/** Copy only checkout files and transferred artifacts, never the caller's dependency tree or caches. */
export async function copyPackageTestWorkspace(
  source: string,
  destination: string,
  checkoutFiles: readonly string[],
  artifacts: readonly string[],
) {
  for (const path of [...new Set([...checkoutFiles, ...artifacts])]) {
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(source, path), target, {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const paths = await packageTestArtifactPaths();
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `paths<<PACKAGE_TEST_ARTIFACTS\n${paths.join("\n")}\nPACKAGE_TEST_ARTIFACTS\n`,
    );
  console.log(paths.join("\n"));
}
