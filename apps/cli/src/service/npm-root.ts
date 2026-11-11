import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { npmRoot } from "@intloom/kernel";

export function npmPrefix(root: string) {
  return process.platform === "win32" ? dirname(root) : resolve(root, "../..");
}

/** Keep the initial npm installation visible to all launchers and future service processes. */
export async function globalPackageRoot(dataDir: string) {
  const file = join(dataDir, "npm-root");
  let root: string;
  try {
    root = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    root = await npmRoot(true, homedir());
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    try {
      await writeFile(file, root, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      root = await readFile(file, "utf8");
    }
  }
  if (!isAbsolute(root)) throw Error("Invalid global npm directory in " + file);
  return root;
}
