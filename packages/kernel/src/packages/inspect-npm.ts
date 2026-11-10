import { join, posix } from "node:path";
import { readFile, realpath } from "node:fs/promises";
import { parse } from "yaml";
import {
  authorManifest,
  verifyArtifact,
} from "@intloom/loom-sdk/package-format";
import { archiveFiles, directoryFiles } from "./source.ts";
import { checkInstalledTree } from "./npm.ts";

/** Inspect compiled commands as data. Package scripts and business modules are never loaded. */
export async function inspectNpmLoomArchive(file: string, globalRoot: string) {
  const files = await archiveFiles(file);
  const yaml = files.get("loom.yaml");
  if (!yaml) return null;
  const manifest = authorManifest.parse(
    parse(Buffer.from(yaml).toString("utf8")),
  );
  const metadata = JSON.parse(
    Buffer.from(files.get("package.json") ?? []).toString("utf8"),
  );
  const defaultCommand =
    manifest.defaultCommand ?? Object.keys(manifest.commands)[0];
  let artifactDigest = "";
  for (const [name, command] of Object.entries(manifest.commands)) {
    const prefix = posix.dirname(command.entry);
    const contents = new Map<string, Uint8Array>();
    for (const [path, bytes] of files) {
      if (prefix === ".") contents.set(path, bytes);
      else if (path.startsWith(prefix + "/"))
        contents.set(path.slice(prefix.length + 1), bytes);
    }
    const artifact = await verifyArtifact(contents);
    if (
      !files.has(command.entry) ||
      metadata.name !== artifact.npmName ||
      metadata.version !== artifact.manifest.version
    )
      return null;
    if (name === defaultCommand)
      artifactDigest = artifact.integrity.artifactDigest;
  }
  const id: string = metadata.name,
    version: string = metadata.version;
  const directory = join(globalRoot, id);
  let installed: "same" | "changed" | "incomplete" | undefined;
  let installedVersion: string | undefined;
  const existing = await readFile(
    join(directory, "package.json"),
    "utf8",
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
  });
  if (existing !== undefined) {
    installedVersion = JSON.parse(existing).version;
    installed = "changed";
    if (installedVersion === version) {
      const local = await directoryFiles(await realpath(directory), true);
      if (
        local.size === files.size &&
        [...files].every(
          ([path, bytes]) =>
            local.has(path) && Buffer.from(bytes).equals(local.get(path)!),
        )
      ) {
        installed = await checkInstalledTree(directory, globalRoot).then(
          () => "same" as const,
          () => "incomplete" as const,
        );
      }
    }
  }
  return {
    id,
    version,
    name: manifest.name,
    description: manifest.description,
    artifactDigest,
    installed,
    installedVersion,
  };
}
