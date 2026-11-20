import { mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { z } from "zod";

export interface DataOptions {
  readonly dataDir?: string;
}

export function isWithin(directory: string, path: string): boolean {
  const suffix = relative(directory, path);
  return (
    suffix === "" ||
    (!isAbsolute(suffix) &&
      suffix !== ".." &&
      !suffix.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

export async function dataRoot(options: DataOptions): Promise<string> {
  const parsed = z
    .strictObject({ dataDir: z.string().min(1).optional() })
    .parse(options);
  const directory = resolve(parsed.dataDir ?? join(homedir(), ".intloom"));
  await mkdir(directory, { recursive: true });
  return realpath(directory);
}

export function loomDirectory(dataDir: string, loomId: string): string {
  return join(dataDir, "looms", encodeURIComponent(loomId));
}

export function runDirectory(
  dataDir: string,
  loomId: string,
  runId: string,
): string {
  return join(loomDirectory(dataDir, loomId), "runs", runId);
}

export async function resolvePath(
  path: string,
  workDir: string,
  followFinal = true,
): Promise<string> {
  const target = resolve(workDir, path);
  if (!followFinal && dirname(target) !== target)
    return join(await resolvePath(dirname(target), workDir), basename(target));
  try {
    return await realpath(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(target);
    if (parent === target) throw error;
    return join(await resolvePath(parent, workDir), basename(target));
  }
}
