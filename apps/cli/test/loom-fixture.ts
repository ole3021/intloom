import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
export async function packDirectory(source: string, destination: string) {
  const result = await execute(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", destination],
    { cwd: source },
  );
  return join(destination, JSON.parse(result.stdout)[0].filename);
}

export async function packFixture(
  base: string,
  version: string,
  compatible = true,
) {
  const directory = join(base, `fixture-${version}`);
  await mkdir(directory);
  const manifest = {
    name: "fixture-loom",
    version,
    type: "module",
    ...(compatible ? { loom: { type: "loom", version: "2026-10-15" } } : {}),
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./package.json": "./package.json",
    },
    scripts: {
      install:
        "node -e \"require('fs').writeFileSync('SCRIPT_RAN', 'unexpected')\"",
    },
  };
  await writeFile(join(directory, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(directory, "index.js"),
    "export const fixture = true;\n",
  );
  return { archive: await packDirectory(directory, base), manifest };
}
