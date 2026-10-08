import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { readLog, type ReadLogOptions } from "@intloom/utils";
import { failure } from "../errors.ts";

async function listLogs(directory: string): Promise<string[]> {
  return (
    await readdir(directory).catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return [];
      throw cause;
    })
  )
    .filter((name) => /^LOG-\d{8}T\d{9}Z\.jsonl$/u.test(name))
    .sort();
}

/** The service owns file creation; follow observes new service lifetimes without starting one. */
export async function readProjectLogs(
  directory: string,
  options: ReadLogOptions & { follow: boolean },
): Promise<void> {
  const names = await listLogs(directory);
  if (!names.length)
    throw failure("NOT_FOUND", "No service logs exist for this project.");
  let selected = options.runId ? names : names.slice(-1);
  let current = selected[0] as string;
  let offset = 0;
  for (;;) {
    for (const name of selected) {
      if (name !== current) {
        current = name;
        offset = 0;
      }
      try {
        offset = await readLog(join(directory, name), { ...options, offset });
      } catch (cause) {
        // Retention may remove a closed file between listing and opening it.
        if (
          !(cause instanceof Error) ||
          !("code" in cause) ||
          cause.code !== "ENOENT"
        )
          throw cause;
      }
    }
    if (!options.follow || options.signal?.aborted) return;
    await setTimeout(100, undefined, { signal: options.signal }).catch(
      (cause: unknown) => {
        if (!options.signal?.aborted) throw cause;
      },
    );
    const fresh = (await listLogs(directory)).filter((name) => name > current);
    // Drain the preceding file before switching to a new service file.
    selected = [current, ...fresh];
  }
}
