import { readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { declarationReferences } from "../package/declaration-references.ts";
import { entryName } from "./generate-entry.ts";

/** The generated source lives in staging; flatten only its emitted entry into the package root. */
export async function relocateEntry(
  output: string,
  temporary: string,
): Promise<void> {
  const directory = resolve(output, basename(temporary));
  for (const suffix of [".js", ".d.ts"]) {
    const source = resolve(directory, `${entryName}${suffix}`);
    let text = await readFile(source, "utf8");
    for (const ref of declarationReferences(text).sort(
      (a, b) => b.start - a.start,
    )) {
      if (ref.kind !== "module" || !ref.specifier.startsWith("../")) continue;
      text =
        text.slice(0, ref.start) +
        JSON.stringify(`./${ref.specifier.slice(3).replace(/\.ts$/, ".js")}`) +
        text.slice(ref.end);
    }
    await writeFile(source, text);
    await rename(source, resolve(output, `${entryName}${suffix}`));
  }
  const mapFile = resolve(directory, `${entryName}.js.map`);
  const map = JSON.parse(await readFile(mapFile, "utf8"));
  map.sources = [`../${entryName}.ts`];
  await writeFile(mapFile, JSON.stringify(map));
  await rename(mapFile, resolve(output, `${entryName}.js.map`));
  await rmdir(directory);
}
