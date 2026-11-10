import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  dependencyClosure,
  PackageError,
} from "@intloom/loom-sdk/package-format";
import { create } from "tar";
import { readArtifact } from "./files.ts";
import type { PackLoomOptions, PackLoomResult } from "./types.ts";

export async function packLoom(
  options: PackLoomOptions,
): Promise<PackLoomResult> {
  const artifact = await readArtifact(options.artifactDir);
  const root = artifact.ref;
  const sources = new Map<string, string>();
  const unidentified: string[] = [];
  for (const source of options.dependencySources ?? []) {
    if (typeof source !== "string")
      sources.set(source.ref.artifactDigest, source.artifactDir);
    else unidentified.push(source);
  }
  const remaining = unidentified.values();
  const loaded = new Map([[root.artifactDigest, artifact]]);
  const pending = Object.values(artifact.manifest.dependencies);
  for (const ref of pending) {
    if (loaded.has(ref.artifactDigest)) continue;
    // Older SDK callers can supply unnamed directories. Read just their index to locate an exact digest.
    while (!sources.has(ref.artifactDigest)) {
      const next = remaining.next();
      if (next.done) break;
      const dir = next.value;
      const index = await readFile(join(dir, "integrity.json"), "utf8").catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
          return undefined;
        },
      );
      if (!index) continue;
      try {
        const digest = JSON.parse(index)?.artifactDigest;
        if (typeof digest === "string") sources.set(digest, dir);
      } catch (error) {
        // An unreadable index cannot identify a directory as the requested dependency.
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    const dir = sources.get(ref.artifactDigest);
    if (!dir)
      throw new PackageError(
        "DEPENDENCY_MISSING",
        `Missing ${ref.id}@${ref.version} (${ref.artifactDigest}).`,
      );
    const dependency = await readArtifact(dir, true);
    if (dependency.ref.artifactDigest !== ref.artifactDigest)
      throw new PackageError(
        "INTEGRITY_MISMATCH",
        `Unexpected contents for ${ref.id}@${ref.version}.`,
      );
    loaded.set(ref.artifactDigest, dependency);
    pending.push(...Object.values(dependency.manifest.dependencies));
  }
  const closure = dependencyClosure([root], [...loaded.values()]);
  const temporary = await mkdtemp(join(tmpdir(), "intloom-pack-"));
  const archiveFile = resolve(options.outFile);
  try {
    for (const artifact of closure)
      for (const [path, bytes] of artifact.files) {
        const target = join(
          temporary,
          "package",
          ...(artifact.ref.artifactDigest === root.artifactDigest
            ? []
            : ["dependencies", artifact.ref.artifactDigest]),
          path,
        );
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      }
    await mkdir(dirname(archiveFile), { recursive: true });
    // Place the final staging file on the destination filesystem for rename.
    const staging = await mkdtemp(join(dirname(archiveFile), ".loom-pack-"));
    try {
      const output = join(staging, "archive.tgz");
      await create(
        {
          cwd: temporary,
          file: output,
          gzip: true,
          portable: true,
          mtime: new Date(0),
        },
        ["package"],
      );
      await rename(output, archiveFile);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    return { archiveFile, root };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
