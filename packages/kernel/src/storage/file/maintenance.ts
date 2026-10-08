import { lstat, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { storageError } from "../errors.ts";

const lockSchema = z.strictObject({
  pid: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});
export type FileStorageLock = z.infer<typeof lockSchema>;

/** Read-only maintenance; does not open Storage or touch store.json. */
export async function inspectFileStorageLock(options: {
  readonly directory: string;
}): Promise<FileStorageLock | undefined> {
  try {
    for (const [path, directory] of [
      [options.directory, true],
      [join(options.directory, "store.lock"), false],
    ] as const) {
      const info = await lstat(path);
      if (
        (directory ? !info.isDirectory() : !info.isFile()) ||
        (!directory &&
          process.platform !== "win32" &&
          (info.mode & 0o077) !== 0)
      )
        throw new Error(
          "Storage lock must be a private ordinary file in an ordinary directory.",
        );
    }
    return lockSchema.parse(
      JSON.parse(await readFile(join(options.directory, "store.lock"), "utf8")),
    );
  } catch (cause) {
    // Shutdown may remove the lock between inspecting its metadata and reading it.
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return undefined;
    throw storageError(cause);
  }
}

/** Host must serialize maintenance with its startup; only an absent owner can be removed. */
export async function recoverFileStorageLock(options: {
  readonly directory: string;
  readonly expected: FileStorageLock;
}): Promise<void> {
  const current = await inspectFileStorageLock(options);
  if (!current || !isDeepStrictEqual(current, options.expected))
    throw KERNEL_ERRORS.create("CONFLICT", {
      message: "Storage lock changed; inspect it again before recovery.",
    });
  try {
    process.kill(current.pid, 0);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ESRCH") {
      await rm(join(options.directory, "store.lock")).catch(
        (error: unknown) => {
          throw storageError(error);
        },
      );
      return;
    }
    throw storageError(cause);
  }
  throw KERNEL_ERRORS.create("BUSY", {
    message: "Storage lock owner still exists; recovery was refused.",
  });
}
