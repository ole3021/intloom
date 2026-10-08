import { lstat, open, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export const logFilePattern = /^LOG-\d{8}T\d{9}Z\.jsonl$/u;
export const maxLogBytes = 1024 * 1024 * 1024;

/** A close marker and a read-only seal together certify successful sync/close. */
export async function retainLogs(
  directory: string,
  maxBytes = maxLogBytes,
  maxAgeMs = 14 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const files: {
    path: string;
    size: number;
    modified: number;
    closed: boolean;
  }[] = [];
  for (const name of await readdir(directory)) {
    if (!logFilePattern.test(name)) continue;
    const path = join(directory, name);
    const info = await lstat(path);
    if (!info.isFile()) continue;
    const file = await open(path, "r");
    let closed = false;
    try {
      const buffer = Buffer.alloc(Math.min(info.size, 2048));
      await file.read(buffer, 0, buffer.length, info.size - buffer.length);
      const last = buffer.toString("utf8").trimEnd().split("\n").at(-1);
      if (last) {
        try {
          closed =
            (info.mode & 0o222) === 0 &&
            JSON.parse(last).event === "log_closed";
        } catch {
          /* An incomplete file is retained for diagnostics. */
        }
      }
    } finally {
      await file.close();
    }
    files.push({ path, size: info.size, modified: info.mtimeMs, closed });
  }
  let size = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files.sort((a, b) => a.modified - b.modified)) {
    if (
      !file.closed ||
      (Date.now() - file.modified <= maxAgeMs && size < maxBytes)
    )
      continue;
    await unlink(file.path);
    size -= file.size;
  }
  return Math.max(0, maxBytes - size);
}
