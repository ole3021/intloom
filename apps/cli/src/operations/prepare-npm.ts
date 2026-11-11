import { runNpm } from "@intloom/kernel";
import { dirname, join, resolve } from "node:path";
import {
  locateNpmLoom,
  npmArchiveName,
  npmRoot,
  readNpmLoom,
} from "@intloom/kernel";
import { IntloomError } from "@intloom/loom-sdk";
import { satisfies } from "semver";

import { globalPackageRoot, npmPrefix } from "../service/npm-root.ts";
export async function installNpmPackage(
  source: string,
  project?: string,
  dataDir?: string,
) {
  const local = await npmArchiveName(resolve(source));
  if (
    !local &&
    (source.endsWith(".tgz") ||
      source.startsWith(".") ||
      source.startsWith("/"))
  )
    return undefined;
  const cwd = resolve(project ?? process.cwd());
  const globalRoot = dataDir
    ? await globalPackageRoot(dataDir)
    : await npmRoot(true, cwd);
  const root = project ? await npmRoot(false, cwd) : globalRoot;
  const flags = project
    ? ["--prefix", dirname(root)]
    : ["--global", "--prefix", npmPrefix(globalRoot)];
  async function install(spec: string) {
    await runNpm(
      [
        "install",
        ...flags,
        "--install-links",
        "--no-audit",
        "--no-fund",
        "--",
        spec,
      ],
      cwd,
    );
  }
  await install(local ? resolve(source) : source);
  const name = local ?? source.replace(/@[^@/]+$/, "");
  const top = await readNpmLoom(join(root, name));
  if (!top)
    throw new IntloomError(
      "PACKAGE_INCOMPATIBLE",
      `Installed package has no loom.yaml: ${name}`,
    );
  async function prepare(
    pkg: NonNullable<typeof top>,
    parents: string[],
  ): Promise<void> {
    if (parents.includes(pkg.name))
      throw new Error(
        `Circular Loom dependency: ${[...parents, pkg.name].join(" → ")}`,
      );
    for (const [child, range] of Object.entries(pkg.manifest.looms ?? {})) {
      let installed = await locateNpmLoom(
        child,
        globalRoot,
        project ? cwd : undefined,
      );
      if (
        installed &&
        (!project || !installed.global) &&
        !satisfies(installed.version, range)
      )
        throw new Error(
          pkg.name +
            " requires " +
            child +
            "@" +
            range +
            "; installed version " +
            installed.version,
        );
      if (!installed || !satisfies(installed.version, range)) {
        await install(`${child}@${range}`);
        installed = await locateNpmLoom(
          child,
          globalRoot,
          project ? cwd : undefined,
        );
      }
      if (!installed || !satisfies(installed.version, range))
        throw new Error(`Missing ${child}@${range}`);
      await prepare(installed, [...parents, pkg.name]);
    }
  }
  await prepare(top, []);
  return { name: top.name, version: top.version, directory: top.directory };
}
