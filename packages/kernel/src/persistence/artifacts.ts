import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { IntloomError, type ArtifactRecord } from "@intloom/loom-sdk";

/** Owns immutable bytes; outcome rules and metadata transactions belong to their services. */
export function createArtifactStorage(runDirectory: (runId: string) => string) {
  const directory = (runId: string) => join(runDirectory(runId), "artifacts");
  async function* verifiedBytes(record: ArtifactRecord) {
    const hash = createHash("sha256");
    let size = 0;
    try {
      for await (const chunk of createReadStream(
        join(directory(record.runId), record.id),
      )) {
        const data = chunk as Buffer;
        hash.update(data);
        yield data;
        size += data.length;
      }
    } catch {
      throw new IntloomError(
        "ARTIFACT_UNAVAILABLE",
        "Artifact bytes are unavailable.",
        { artifactId: record.id },
      );
    }
    if (size !== record.size || hash.digest("hex") !== record.digest)
      throw new IntloomError(
        "ARTIFACT_UNAVAILABLE",
        "Artifact bytes do not match their immutable record.",
        { artifactId: record.id },
      );
  }
  return {
    async read(record: ArtifactRecord, offset = 0, length = record.size) {
      const value = new Uint8Array(Math.min(length, record.size - offset));
      let position = 0;
      for await (const data of verifiedBytes(record)) {
        const start = Math.max(offset, position);
        const end = Math.min(offset + value.length, position + data.length);
        if (start < end)
          value.set(
            data.subarray(start - position, end - position),
            start - offset,
          );
        position += data.length;
      }
      return value;
    },
    async export(record: ArtifactRecord, path: string, overwrite = false) {
      const temporary = await mkdtemp(join(dirname(path), ".intloom-export-"));
      const prepared = join(temporary, "content");
      try {
        const file = await open(prepared, "wx", 0o600);
        try {
          for await (const bytes of verifiedBytes(record))
            await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        if (overwrite) await rename(prepared, path);
        else
          await link(prepared, path).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "EEXIST")
              throw new IntloomError(
                "FILE_EXISTS",
                "Destination exists; use --overwrite to replace it.",
              );
            throw error;
          });
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
      return { artifactId: record.id, path, size: record.size };
    },
    async write(record: ArtifactRecord, value: Uint8Array) {
      try {
        await mkdir(directory(record.runId), { recursive: true });
        const file = await open(
          join(directory(record.runId), record.id),
          "wx",
          0o600,
        );
        try {
          await file.writeFile(value);
          await file.sync();
        } finally {
          await file.close();
        }
      } catch {
        throw new IntloomError(
          "STORAGE_FAILED",
          "Artifact bytes could not be saved.",
        );
      }
    },
  };
}
