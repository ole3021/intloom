import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const files = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".spec.ts"))
  .map((entry) => fileURLToPath(new URL(entry.name, directory)))
  .sort();
if (!files.length) throw new Error("No repository script tests found.");
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
