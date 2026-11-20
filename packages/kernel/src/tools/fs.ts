import { randomUUID } from "node:crypto";
import {
  lstat,
  stat,
  readFile,
  writeFile,
  rename,
  mkdir,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  decodeUtf8,
  encodeUtf8,
  fileInputs,
  type FileInfo,
  type FileTools,
} from "@intloom/loom-sdk";
import { isWithin } from "../paths.ts";
import type { Processes } from "./processes.ts";

export interface CleanupFailure {
  readonly path: string;
  readonly message: string;
}

function fileType(info: {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}): FileInfo["type"] {
  return info.isFile()
    ? "file"
    : info.isDirectory()
      ? "directory"
      : info.isSymbolicLink()
        ? "symlink"
        : "other";
}

export function createFileTools(
  signal: AbortSignal,
  processes: Processes,
  authorize: (
    path: string,
    operation: "read" | "write",
    followFinal?: boolean,
  ) => Promise<string> = async (path) => path,
) {
  const directories = new Set<string>();
  const operations = new Set<Promise<unknown>>();
  const cleanupFailures: CleanupFailure[] = [];
  const record = (path: string, error: unknown) =>
    cleanupFailures.push({
      path,
      message: error instanceof Error ? error.message : String(error),
    });
  const track = async <T>(operation: () => Promise<T>): Promise<T> => {
    const promise = operation();
    operations.add(promise);
    try {
      return await promise;
    } catch (error) {
      throw signal.aborted ? signal.reason : error;
    } finally {
      operations.delete(promise);
    }
  };
  const removeTemporary = async (path: string) => {
    await processes.stop(path);
    try {
      await rm(path, { recursive: true, force: true });
      for (const directory of directories)
        if (isWithin(path, directory)) directories.delete(directory);
    } catch (error) {
      record(path, error);
      throw error;
    }
  };
  const tools: FileTools = {
    read: (input) =>
      track(async () => {
        const request = fileInputs.read.parse(input);
        const path = await authorize(request.path, "read");
        signal.throwIfAborted();
        return decodeUtf8(await readFile(path, { signal }));
      }),
    write: (input) =>
      track(async () => {
        const { path: requested, content } = fileInputs.write.parse(input);
        const path = await authorize(requested, "write");
        signal.throwIfAborted();
        const bytes = encodeUtf8(content);
        const temporary = join(dirname(path), `.intloom-write-${randomUUID()}`);
        try {
          await writeFile(temporary, bytes, { flag: "wx", signal });
          signal.throwIfAborted();
          await rename(temporary, path);
        } finally {
          await rm(temporary, { force: true }).catch((error) =>
            record(temporary, error),
          );
        }
      }),
    mkdir: (input) =>
      track(async () => {
        const request = fileInputs.mkdir.parse(input);
        const path = await authorize(request.path, "write");
        signal.throwIfAborted();
        await mkdir(path, { recursive: true });
      }),
    stat: (input) =>
      track(async () => {
        const { path: requested, followSymlinks } =
          fileInputs.stat.parse(input);
        const path = await authorize(
          requested,
          "read",
          followSymlinks ?? false,
        );
        signal.throwIfAborted();
        try {
          const info = await (followSymlinks ? stat : lstat)(path);
          return { type: fileType(info), size: info.size };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
    list: (input) =>
      track(async () => {
        const request = fileInputs.list.parse(input);
        const path = await authorize(request.path, "read");
        signal.throwIfAborted();
        return (await readdir(path, { withFileTypes: true })).map((entry) => ({
          name: entry.name,
          type: fileType(entry),
        }));
      }),
    mkdtemp: (input) =>
      track(async () => {
        const { directory: requested, prefix } =
          fileInputs.mkdtemp.parse(input);
        const directory = await authorize(requested, "write");
        signal.throwIfAborted();
        const path = await mkdtemp(join(directory, prefix ?? "loom-"));
        directories.add(path);
        return path;
      }),
    remove: (input) =>
      track(async () => {
        const { path: requested, recursive } = fileInputs.remove.parse(input);
        const path = await authorize(requested, "write", false);
        if (directories.has(path) && recursive) return removeTemporary(path);
        signal.throwIfAborted();
        await processes.stop(path);
        await rm(path, { recursive: recursive ?? false, force: true });
      }),
  };
  return {
    tools,
    cleanupFailures,
    async close(): Promise<void> {
      await Promise.allSettled(operations);
      for (const path of directories)
        await removeTemporary(path).catch(() => {});
    },
  };
}
