import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { publications, readManifest, repositoryRoot } from "./publication.ts";
import { readReleasePlan, releaseDirectory } from "./release-files.ts";

const run = promisify(execFile);
const args = process.argv.slice(2);
if (args.length > 1 || (args[0]?.startsWith("-") && args[0] !== "--selected"))
  throw new Error(
    "Usage: node scripts/pack-package.ts [directory | --selected]",
  );
if (args[0] === "--selected") {
  const plan = await readReleasePlan();
  const filters = [
    ...new Set(
      publications
        .filter((item) => plan.selected.includes(item.name))
        .map((item) => (item.name === "intloom" ? "@intloom/cli" : item.name)),
    ),
  ];
  if (filters.length) {
    const { stdout } = await run(
      "bun",
      ["run", "pack", ...filters.map((name) => `--filter=${name}`)],
      { cwd: repositoryRoot, maxBuffer: 4 * 1024 * 1024 },
    );
    process.stdout.write(stdout);
  } else console.log("No packages selected; packing skipped.");
} else {
  const root = resolve(args[0] ?? ".");
  const manifest = await readManifest(root);
  await mkdir(releaseDirectory, { recursive: true });
  const { stdout } = await run(
    "bun",
    [
      "pm",
      "pack",
      "--ignore-scripts",
      "--quiet",
      "--destination",
      releaseDirectory,
    ],
    { cwd: root },
  );
  // Final archive validation and integrity belong to release-manifest.
  console.log(
    JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      archive: resolve(releaseDirectory, stdout.trim()),
    }),
  );
}
