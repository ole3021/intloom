import { lstat, readdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { compiledLoomSchema } from "@intloom/loom-sdk";

export async function writeOutput(
  stage: string,
  output: string,
  previous: string,
  packageName: string,
): Promise<void> {
  let exists = false;
  try {
    if (!(await lstat(output)).isDirectory())
      throw new Error(`Output '${output}' must be a directory`);
    exists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (exists) {
    if ((await readdir(output)).length) {
      let content: string;
      try {
        content = await readFile(join(output, "loom.json"), "utf8");
      } catch {
        throw new Error(
          `Refusing to replace '${output}': it is not a previous Loom build`,
        );
      }
      const manifest = compiledLoomSchema.parse(JSON.parse(content));
      if (manifest.package.name !== packageName)
        throw new Error("Output directory belongs to another Loom package");
    }
    await rename(output, previous);
  }
  try {
    await rename(stage, output);
  } catch (error) {
    if (exists) await rename(previous, output);
    throw error;
  }
  if (exists) await rm(previous, { recursive: true, force: true });
}
