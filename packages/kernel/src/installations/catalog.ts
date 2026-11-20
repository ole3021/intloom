import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  compiledLoomSchema,
  decodeUtf8,
  packageIdentitySchema,
  relativePathSchema,
  type PackageIdentity,
} from "@intloom/loom-sdk";
import { z } from "zod";
import {
  installationInputSchema,
  type Installation,
  type InstallationInput,
} from "./contracts.ts";
import { isWithin, loomDirectory } from "../paths.ts";

const metadataSchema = packageIdentitySchema.strip().extend({
  type: z.literal("module"),
  loom: relativePathSchema,
});
const dependencySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

async function snapshot(
  source: string,
  destination: string,
  root: string,
  dependencies: { path: string; name: string; version: string }[],
): Promise<void> {
  await mkdir(destination);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      await snapshot(from, to, root, dependencies);
    } else if (entry.isFile()) {
      await copyFile(from, to);
      await chmod(to, (await stat(from)).mode & 0o777);
    } else if (entry.isSymbolicLink()) {
      const target = await realpath(from);
      if (!isWithin(root, target))
        throw new Error(
          `Installation link leaves the prepared directory: ${from}`,
        );
      await symlink(
        relative(dirname(from), target),
        to,
        (await stat(target)).isDirectory() ? "dir" : "file",
      );
    } else {
      throw new Error(`Unsupported installation file: ${from}`);
    }
    const path = relative(root, from).split("\\").join("/");
    if (
      (entry.isDirectory() || entry.isSymbolicLink()) &&
      /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^./][^/]*$/.test(path) &&
      !/^@[^/]+$/.test(entry.name)
    ) {
      const metadata = dependencySchema.parse(
        JSON.parse(decodeUtf8(await readFile(join(from, "package.json")))),
      );
      dependencies.push({ path, ...metadata });
    }
  }
}

export function installations(database: DatabaseSync, dataDir: string) {
  function get(identity: PackageIdentity): Installation | undefined {
    const { name, version } = identity;
    const row = database
      .prepare(
        "SELECT record FROM installations WHERE name = ? AND version = ?",
      )
      .get(name, version);
    return row ? (JSON.parse(row.record as string) as Installation) : undefined;
  }

  return {
    get(identity: PackageIdentity) {
      return get(packageIdentitySchema.parse(identity));
    },
    async register(raw: InstallationInput): Promise<Installation> {
      const input = installationInputSchema.parse(raw);
      const sourceRoot = await realpath(resolve(input.directory));
      const packageRoot = await realpath(
        resolve(sourceRoot, input.packagePath),
      );
      if (!isWithin(sourceRoot, packageRoot))
        throw new Error("Package path leaves the prepared installation");
      const metadata = metadataSchema.parse(
        JSON.parse(
          decodeUtf8(await readFile(join(packageRoot, "package.json"))),
        ),
      );
      const identity = { name: metadata.name, version: metadata.version };
      if (get(identity))
        throw new Error(
          `Installation already registered: ${identity.name}@${identity.version}`,
        );
      const manifestPath = await realpath(join(packageRoot, metadata.loom));
      if (!isWithin(packageRoot, manifestPath))
        throw new Error("Compiled manifest leaves the Loom package");
      const manifest = compiledLoomSchema.parse(
        JSON.parse(decodeUtf8(await readFile(manifestPath))),
      );
      if (
        manifest.package.name !== identity.name ||
        manifest.package.version !== identity.version
      )
        throw new Error("Compiled Loom identity does not match package.json");
      const packageFiles = [
        manifest.entry.module,
        ...(manifest.agent ? [manifest.agent.module] : []),
        ...manifest.resources,
        ...manifest.skills.map((skill) => skill.path),
      ];
      for (const file of packageFiles) {
        if (!isWithin(packageRoot, await realpath(join(packageRoot, file))))
          throw new Error(`Loom resource leaves its package: ${file}`);
      }
      const parent = join(
        loomDirectory(dataDir, identity.name),
        "installations",
      );
      const directory = join(parent, encodeURIComponent(identity.version));
      if (isWithin(sourceRoot, directory))
        throw new Error(
          "Managed installation must be outside the prepared directory",
        );
      await mkdir(parent, { recursive: true });
      const temporary = await mkdtemp(join(parent, ".prepare-"));
      const staged = join(temporary, "installation");
      let moved = false;
      try {
        const dependencies: { path: string; name: string; version: string }[] =
          [];
        await snapshot(sourceRoot, staged, sourceRoot, dependencies);
        const installation: Installation = {
          package: identity,
          directory,
          packagePath:
            relative(sourceRoot, packageRoot).split("\\").join("/") || ".",
          manifest,
          ...(input.source === undefined ? {} : { source: input.source }),
          registeredAt: new Date().toISOString(),
          dependencies: dependencies.sort((a, b) =>
            a.path.localeCompare(b.path),
          ),
        };
        await rename(staged, directory);
        moved = true;
        database
          .prepare(
            "INSERT INTO installations (name, version, record) VALUES (?, ?, ?)",
          )
          .run(identity.name, identity.version, JSON.stringify(installation));
        return installation;
      } catch (error) {
        if (moved) await rm(directory, { recursive: true, force: true });
        throw error;
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    },
  };
}
