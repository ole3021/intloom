import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const kernelUrl = new URL("../../dist/index.js", import.meta.url).href;

export async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "intloom-data-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, dataDir: join(root, "data") };
}

export async function prepared(
  root,
  version = "1.0.0",
  name = "@fixture/report",
) {
  const directory = join(root, `prepared-${version}`);
  await mkdir(join(directory, "assets"), { recursive: true });
  await mkdir(join(directory, "node_modules/fixture-dependency"), {
    recursive: true,
  });
  await mkdir(join(directory, "node_modules/.bin"), { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name,
      version,
      type: "module",
      loom: "./loom.json",
      dependencies: { "fixture-dependency": "1.0.0" },
    }),
  );
  await writeFile(
    join(directory, "loom.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      package: { name, version },
      name: "Display name",
      entry: { module: "main.js", export: "default", kind: "code" },
      execution: { scope: "intloom" },
      resources: ["assets"],
      skills: [],
    }),
  );
  await writeFile(
    join(directory, "main.js"),
    'export { label } from "fixture-dependency"; export default async function main() {}\n',
  );
  await writeFile(
    join(directory, "assets/evidence.txt"),
    `evidence ${version}`,
  );
  await writeFile(
    join(directory, "node_modules/fixture-dependency/package.json"),
    JSON.stringify({
      name: "fixture-dependency",
      version: "1.0.0",
      type: "module",
      exports: "./index.js",
    }),
  );
  await writeFile(
    join(directory, "node_modules/fixture-dependency/index.js"),
    `export const label = ${JSON.stringify(version)};\n`,
  );
  await symlink(
    "../fixture-dependency/index.js",
    join(directory, "node_modules/.bin/fixture"),
    "file",
  );
  return directory;
}
