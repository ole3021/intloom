import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, chmod } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  matchesGlob,
  relative,
  resolve,
  sep,
} from "node:path";
import * as z from "zod";
import { digest } from "./contracts.ts";
import type { LoomPackage } from "../loom/types.ts";

const fileEntry = z.strictObject({
  path: z.string(),
  type: z.literal("file"),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  executable: z.boolean(),
});
const directoryEntry = z.strictObject({
  path: z.string(),
  type: z.literal("directory"),
});
export const filesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(z.discriminatedUnion("type", [fileEntry, directoryEntry])),
  excluded: z.array(z.string()),
  includes: z.array(z.string()),
});
export type MirrorFiles = z.infer<typeof filesSchema>;
export interface MirrorFileOptions {
  include?: readonly string[];
  exclude?: readonly string[];
  protectedPaths?: readonly string[];
  storagePath?: string;
}
export const systemExclusions = [
  ".git",
  ".intloom",
  "node_modules",
  "intloom",
  ".cache",
  ".aws",
  ".ssh",
  ".codex",
  ".agents",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "coverage",
  ".turbo",
  "tmp",
  "temp",
  "intloom.yaml",
  "intloom.config.yaml",
  "package.json",
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];
export function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}
export function safeRelative(path: string): void {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    /\p{Cc}/u.test(path) ||
    path
      .split("/")
      .some(
        (part) => !part || part === "." || part === ".." || part.includes(":"),
      )
  )
    throw new Error(`Unsafe mirror path: ${path}`);
}
export async function safePath(root: string, path: string): Promise<string> {
  safeRelative(path);
  // Check the root and every ancestor, including existing parents of a new file.
  const target = resolve(root, path);
  for (let current = target; ; current = dirname(current)) {
    const info = await lstat(current).catch((cause: unknown) => {
      if (isMissing(cause)) return undefined;
      throw cause;
    });
    if (info?.isSymbolicLink())
      throw new Error(`Symbolic link in mirror path: ${current}`);
    if (current !== target && info && !info.isDirectory())
      throw new Error(`Mirror path parent is not a directory: ${current}`);
    if (current === root) break;
    if (!inside(root, current))
      throw new Error(`Mirror path escapes root: ${path}`);
  }
  return target;
}
export function isMissing(cause: unknown): boolean {
  return (
    !!cause &&
    typeof cause === "object" &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
export async function exists(path: string): Promise<boolean> {
  return !!(await lstat(path).catch((cause: unknown) => {
    if (isMissing(cause)) return undefined;
    throw cause;
  }));
}
export async function readBytes(root: string, path: string): Promise<Buffer> {
  const filename = await safePath(root, path);
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new Error(`Mirror requires an ordinary file: ${path}`);
    return await file.readFile();
  } finally {
    await file.close();
  }
}
export async function writeBytes(
  root: string,
  path: string,
  bytes: Uint8Array,
  executable = false,
  onCreated?: (path: string) => void | Promise<void>,
): Promise<void> {
  const file = await safePath(root, path);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await safePath(root, path);
  const handle = await open(
    file,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    executable ? 0o700 : 0o600,
  );
  try {
    await onCreated?.(file);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(file, executable ? 0o700 : 0o600);
}
export async function protectedLoomPaths(
  root: string,
  sources: Readonly<Record<string, LoomPackage>>,
): Promise<string[]> {
  const paths: string[] = [];
  for (const source of Object.values(sources)) {
    const directory = await realpath(source.packageRoot);
    const assets = await realpath(source.assetRoot);
    for (const file of source.protectedFiles ?? []) {
      const actual = await realpath(file);
      if (inside(root, actual))
        paths.push(relative(root, actual).split(sep).join("/"));
    }
    for (const path of [directory === root ? assets : directory]) {
      if (inside(root, path)) {
        const rel = relative(root, path).split(sep).join("/");
        if (!rel)
          throw new Error(
            "Loom resources cover the entire business workspace.",
          );
        paths.push(rel);
      }
    }
  }
  return [...new Set(paths)].sort();
}
function excluded(path: string, options: MirrorFileOptions): boolean {
  const parts = path.normalize("NFC").toLocaleLowerCase("en-US").split("/");
  if (
    parts.some(
      (part) =>
        systemExclusions.includes(part) ||
        /^\.env(?:$|\.)|^\.dev.vars|\.(?:pem|key)$/u.test(part),
    )
  )
    return true;
  if (
    options.protectedPaths?.some(
      (prefix) =>
        path.normalize("NFC").toLocaleLowerCase("en-US") ===
          prefix.normalize("NFC").toLocaleLowerCase("en-US") ||
        path
          .normalize("NFC")
          .toLocaleLowerCase("en-US")
          .startsWith(`${prefix.normalize("NFC").toLocaleLowerCase("en-US")}/`),
    )
  )
    return true;
  if (
    options.storagePath &&
    (path === options.storagePath || path.startsWith(`${options.storagePath}/`))
  )
    return true;
  return (
    options.exclude?.some(
      (pattern) =>
        matchesGlob(path, pattern) || matchesGlob(`${path}/`, pattern),
    ) ?? false
  );
}
function selected(path: string, options: MirrorFileOptions): boolean {
  const explicit =
    options.include?.some((pattern) => matchesGlob(path, pattern)) ?? false;
  return !path.split("/").includes("dist") || explicit;
}
export async function scanFiles(
  root: string,
  options: MirrorFileOptions,
): Promise<MirrorFiles> {
  const entries: MirrorFiles["entries"] = [];
  const names = new Set<string>();
  let total = 0;
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const item of (await readdir(directory, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = `${prefix}${item.name}`;
      if (excluded(path, options)) continue;
      if (entries.length >= 10000)
        throw new Error("Mirror file safety limit exceeded (10000 entries).");
      safeRelative(path);
      const normalized = path.normalize("NFC").toLocaleLowerCase("en-US");
      if (names.has(normalized))
        throw new Error(`Case or Unicode normalization conflict: ${path}`);
      names.add(normalized);
      const filename = await safePath(root, path);
      const info = await lstat(filename);
      if (info.isDirectory()) {
        if (item.name === "dist" && !options.include?.length) continue;
        const before = entries.length;
        await visit(filename, `${path}/`);
        if (entries.length === before && selected(path, options))
          entries.push({ path, type: "directory" });
      } else if (info.isFile()) {
        if (!selected(path, options)) continue;
        if (
          info.size > 64 * 1024 * 1024 ||
          total + info.size > 1024 * 1024 * 1024 ||
          entries.length >= 10000
        )
          throw new Error(
            `Mirror file safety limit exceeded (64 MiB/file, 1 GiB/image, 10000 entries): ${path}`,
          );
        const bytes = await readBytes(root, path);
        total += bytes.length;
        entries.push({
          path,
          type: "file",
          size: bytes.length,
          sha256: digest(bytes),
          executable: (info.mode & 0o111) !== 0,
        });
      } else throw new Error(`Unsupported mirror file type: ${path}`);
    }
  }
  await visit(root, "");
  return {
    schemaVersion: 1,
    entries,
    excluded: [
      ...systemExclusions.flatMap((path) => [path, `${path}/**`]),
      ".env*",
      ".dev.vars*",
      "*.pem",
      "*.key",
      ...(options.protectedPaths ?? []).flatMap((path) => [path, `${path}/**`]),
      ...(options.storagePath ? [`${options.storagePath}/**`] : []),
      ...(options.exclude ?? []),
      "dist/** (unless explicitly included)",
    ],
    includes: ["**", ...(options.include ?? [])],
  };
}
export function validateFilePaths(
  files: MirrorFiles,
  options: MirrorFileOptions = {},
): void {
  const names = new Map<string, MirrorFiles["entries"][number]>();
  for (const entry of files.entries) {
    safeRelative(entry.path);
    if (excluded(entry.path, options))
      throw new Error(
        `Mirror path conflicts with protected target path: ${entry.path}`,
      );
    const name = entry.path.normalize("NFC").toLocaleLowerCase("en-US");
    if (names.has(name))
      throw new Error(`Duplicate normalized mirror path: ${entry.path}`);
    names.set(name, entry);
  }
  for (const entry of files.entries) {
    const components = entry.path
      .normalize("NFC")
      .toLocaleLowerCase("en-US")
      .split("/");
    for (let count = 1; count < components.length; count++)
      if (names.get(components.slice(0, count).join("/"))?.type === "file")
        throw new Error(`File used as a mirror directory: ${entry.path}`);
  }
}
export async function copyFiles(
  source: string,
  target: string,
  files: MirrorFiles,
): Promise<void> {
  validateFilePaths(files);
  for (const entry of files.entries) {
    if (entry.type === "directory") {
      await mkdir(await safePath(target, entry.path), {
        recursive: true,
        mode: 0o700,
      });
      continue;
    }
    const bytes = await readBytes(source, entry.path);
    if (bytes.length !== entry.size || digest(bytes) !== entry.sha256)
      throw new Error(`Mirror file digest mismatch: ${entry.path}`);
    await writeBytes(target, entry.path, bytes, entry.executable);
  }
}
export async function verifyFiles(
  root: string,
  files: MirrorFiles,
): Promise<void> {
  validateFilePaths(files);
  for (const entry of files.entries) {
    const info = await lstat(await safePath(root, entry.path));
    if (entry.type === "directory") {
      if (!info.isDirectory())
        throw new Error(`Missing mirror directory: ${entry.path}`);
      continue;
    }
    const bytes = await readBytes(root, entry.path);
    if (
      bytes.length !== entry.size ||
      digest(bytes) !== entry.sha256 ||
      ((info.mode & 0o111) !== 0) !== entry.executable
    )
      throw new Error(`Mirror file integrity mismatch: ${entry.path}`);
  }
}
