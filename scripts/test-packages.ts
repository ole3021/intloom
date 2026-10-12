import { access } from "node:fs/promises";
import { resolve } from "node:path";
import {
  publications,
  readManifest,
  repositoryRoot,
  type PublicationName,
} from "./publication.ts";
import { releaseDirectory } from "./release-files.ts";

/** Consume the archives produced by Turbo's pack prerequisites, without repacking per suite. */
export async function testArchives(names: readonly PublicationName[]) {
  const result: Record<string, string> = {};
  for (const name of names) {
    const item = publications.find((item) => item.name === name);
    if (!item) throw new Error(`Unknown publication: ${name}`);
    const manifest = await readManifest(
      resolve(repositoryRoot, item.directory, item.entry),
    );
    const file = resolve(
      releaseDirectory,
      `${name.replace(/^@/u, "").replace("/", "-")}-${manifest.version}.tgz`,
    );
    await access(file);
    result[name] = file;
  }
  return result;
}
