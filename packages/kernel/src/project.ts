import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** The nearest intloom.yaml defines the project; JSON files are not project markers. */
export async function findProject(
  directory: string,
): Promise<string | undefined> {
  let current = resolve(directory);
  for (;;) {
    try {
      if ((await stat(join(current, "intloom.yaml"))).isFile()) return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
