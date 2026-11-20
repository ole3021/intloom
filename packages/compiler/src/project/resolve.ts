import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Diagnostic } from "@intloom/loom-sdk";

export function isWithin(root: string, path: string): boolean {
  const local = relative(root, path);
  return (
    local === "" ||
    (!isAbsolute(local) && local !== ".." && !local.startsWith(`..${sep}`))
  );
}

export function packagePath(path: string): string {
  return path.split(sep).join("/");
}

export interface ResolvedReference {
  readonly source: string;
  readonly module: string;
  readonly export: string;
}

export async function resolveReference(
  root: string,
  reference: string,
  diagnostics: Diagnostic[],
): Promise<ResolvedReference | undefined> {
  const [local = "", name = "default"] = reference.split("#");
  const source = resolve(root, local);
  try {
    if (
      !isWithin(await realpath(root), await realpath(source)) ||
      !(await stat(source)).isFile()
    ) {
      diagnostics.push({
        code: "INVALID_REFERENCE",
        file: source,
        message: "The module must be a file inside this Loom package",
      });
      return;
    }
  } catch (error) {
    diagnostics.push({
      code: "MISSING_MODULE",
      file: source,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  return {
    source,
    module: `./${packagePath(relative(root, source))
      .replace(/\.mts$/, ".mjs")
      .replace(/\.ts$/, ".js")}`,
    export: name,
  };
}
