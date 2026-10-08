import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fail } from "../errors.ts";

export async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (cause) {
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ENOENT"
    )
      return false;
    throw cause;
  }
}

export async function listOutputFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isSymbolicLink())
      fail("INVALID_OUTPUT", "Output must not contain symlinks", { file });
    if (entry.isDirectory()) result.push(...(await listOutputFiles(file)));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

export async function relocateSourceMaps(
  output: string,
  destination: string,
): Promise<void> {
  for (const file of await listOutputFiles(output)) {
    if (!file.endsWith(".js.map")) continue;
    const map = JSON.parse(await readFile(file, "utf8")) as {
      sources: string[];
      sourceRoot?: string;
    };
    const finalDirectory = dirname(
      resolve(destination, relative(output, file)),
    );
    map.sources = map.sources.map((source) =>
      relative(
        finalDirectory,
        resolve(dirname(file), map.sourceRoot ?? "", source),
      ).replaceAll("\\", "/"),
    );
    map.sourceRoot = "";
    await writeFile(file, JSON.stringify(map));
  }
}
