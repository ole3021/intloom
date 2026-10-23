import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { SourcePackage, SourceStage } from "../../src/source/schemas.ts";

export async function editStage(
  root: string,
  name: string,
  edit: (stage: SourceStage["stage"]) => void,
) {
  const file = resolve(root, `stages/${name}.yaml`);
  const document = parse(await readFile(file, "utf8")) as SourceStage;
  edit(document.stage);
  await writeFile(file, JSON.stringify(document, null, 2));
}
export async function editManifest(
  root: string,
  edit: (manifest: SourcePackage) => void,
) {
  const file = resolve(root, "package.json");
  const manifest = JSON.parse(await readFile(file, "utf8")) as SourcePackage;
  edit(manifest);
  await writeFile(file, JSON.stringify(manifest, null, 2));
}
