import { cp, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { Diagnostic } from "@intloom/loom-sdk";
import { isWithin, packagePath } from "../project/resolve.ts";

export async function collectResources(
  root: string,
  stage: string,
  paths: readonly string[],
  excluded: readonly string[],
  diagnostics: Diagnostic[],
  copied = new Set<string>(),
): Promise<string[]> {
  const collected: string[] = [];
  const realRoot = await realpath(root);
  const copy = async (source: string): Promise<void> => {
    const real = await realpath(source);
    const local = packagePath(relative(root, source));
    if (
      !isWithin(realRoot, real) ||
      excluded.some((path) => isWithin(path, real)) ||
      local
        .split("/")
        .some((part) => part === "node_modules" || part === ".git")
    ) {
      diagnostics.push({
        code: "INVALID_RESOURCE",
        file: source,
        message:
          "Resources must stay inside the Loom and cannot include dependencies, repository internals or build directories",
      });
      return;
    }
    const info = await lstat(real);
    if (info.isDirectory()) {
      await mkdir(join(stage, local), { recursive: true });
      for (const name of (await readdir(real)).sort())
        await copy(join(source, name));
    } else if (info.isFile() && !copied.has(local)) {
      if (local === "package.json" || local === "loom.json") {
        diagnostics.push({
          code: "RESOURCE_COLLISION",
          file: source,
          message: "This path is reserved for generated package metadata",
        });
        return;
      }
      const destination = join(stage, local);
      try {
        await lstat(destination);
        diagnostics.push({
          code: "RESOURCE_COLLISION",
          file: source,
          message: "This resource would overwrite compiled code",
        });
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination, {
        dereference: true,
        preserveTimestamps: true,
      });
      copied.add(local);
    }
  };
  const unique = [
    ...new Set(
      paths.map((path) => packagePath(relative(root, resolve(root, path)))),
    ),
  ].sort();
  for (const local of unique.filter(
    (path, _, all) =>
      !all.some((parent) => parent !== path && path.startsWith(`${parent}/`)),
  )) {
    try {
      await copy(resolve(root, local));
      collected.push(`./${local}`);
    } catch (error) {
      diagnostics.push({
        code: "MISSING_RESOURCE",
        file: resolve(root, local),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return collected;
}
