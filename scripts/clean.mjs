import { readdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
for (const group of ["apps", "packages", "examples"]) {
  for (const entry of await readdir(new URL(`${group}/`, root), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) {
      await rm(new URL(`${group}/${entry.name}/dist/`, root), {
        recursive: true,
        force: true,
      });
    }
  }
}
