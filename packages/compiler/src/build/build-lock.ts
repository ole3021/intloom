import { open, readFile, rm, type FileHandle } from "node:fs/promises";
import { hostname } from "node:os";
import { resolve } from "node:path";
import { fail } from "../errors.ts";

/** An explicit lock never doubles as an author source file. Interrupted locks retain owner evidence. */
export async function withBuildLock<T>(
  root: string,
  build: () => Promise<T>,
): Promise<T> {
  const file = resolve(root, ".intloom-build.lock");
  let handle: FileHandle;
  try {
    handle = await open(file, "wx");
  } catch (cause) {
    let owner = "";
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      if (
        Number.isSafeInteger(value.pid) &&
        value.pid > 0 &&
        typeof value.host === "string"
      ) {
        owner = ` Owner: process ${value.pid} on ${value.host}.`;
        if (value.host === hostname()) {
          try {
            process.kill(value.pid, 0);
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ESRCH"
            )
              owner +=
                " That process has exited; inspect .intloom-build-* for recovery backups, then remove this lock to rebuild.";
          }
        }
      }
    } catch {
      /* A concurrent builder may still be writing its ownership record. */
    }
    fail(
      "BUILD_FAILED",
      `Cannot acquire the package build lock.${owner}`,
      { file },
      cause,
    );
  }
  let failure: { cause: unknown } | undefined;
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, host: hostname() }),
    );
    await handle.close();
    return await build();
  } catch (cause) {
    failure = { cause };
    throw cause;
  } finally {
    try {
      await handle.close();
      await rm(file);
    } catch (cause) {
      fail(
        "BUILD_FAILED",
        "Unable to release build lock; inspect output before retrying",
        { file },
        new AggregateError(
          failure ? [failure.cause, cause] : [cause],
          "Build lock cleanup failed",
        ),
      );
    }
  }
}
