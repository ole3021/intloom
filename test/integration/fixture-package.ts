import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// These generated author fixtures declare their Loom ID as a string literal.
export async function writeFixturePackage(entry: string) {
  const source = await readFile(entry, "utf8");
  const name = /defineLoom\(\{\s*id:\s*["']([^"']+)["']/.exec(source)?.[1];
  const version = /version:\s*["']([^"']+)["']/.exec(source)?.[1];
  if (!name) throw new Error(`Missing fixture Loom ID in ${entry}`);
  await writeFile(
    join(dirname(entry), "package.json"),
    JSON.stringify({ name, version, type: "module" }),
  );
}
