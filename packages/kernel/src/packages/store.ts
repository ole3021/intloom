import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { InstalledLoomRef, LoomCatalogEntry } from "@intloom/loom-sdk";
import {
  dependencyClosure,
  PackageError,
  parseManifest,
} from "@intloom/loom-sdk/package-format";
import { stableJson } from "@intloom/loom-sdk/json";
import { createClient } from "@libsql/client";
import {
  readPackageDirectory,
  readPackageSource,
  type PackageSource,
} from "./source.ts";

export interface PackageStore {
  removeDirect(id: string): Promise<boolean>;
  listDirect(): Promise<readonly LoomCatalogEntry[]>;
  installLoom(options: {
    readonly source: string;
    readonly dependencySources?: readonly string[];
    readonly snapshotOnly?: boolean;
    readonly installedDirectory?: boolean;
    readonly expected?: { id: string; version?: string };
  }): Promise<InstalledLoomRef>;
  listLooms(): Promise<readonly LoomCatalogEntry[]>;
  getLoom(selector: {
    readonly id: string;
    readonly version: string;
    readonly artifactDigest?: string;
  }): Promise<LoomCatalogEntry>;
  close(): Promise<void>;
}

/** @internal Local composition for package operations; shared with the Kernel. */
export async function createPackageStore(options: {
  readonly dataDir: string;
}): Promise<PackageStore> {
  const dataDir = resolve(options.dataDir);
  await mkdir(dataDir, { recursive: true });
  const owner = createClient({
    url: pathToFileURL(join(dataDir, "owner.db")).href,
  });
  await owner.execute("PRAGMA busy_timeout = 0");
  // A held SQLite write transaction gives process-scoped ownership; the OS releases it on exit.
  const lease = await owner.transaction("write").catch((error: unknown) => {
    owner.close();
    if ((error as { code?: string }).code === "SQLITE_BUSY")
      throw new PackageError(
        "DATA_DIR_IN_USE",
        "The Intloom service is already running.",
      );
    throw error;
  });
  const database = createClient({
    url: pathToFileURL(join(dataDir, "packages.db")).href,
  });
  const catalog = new Map<string, LoomCatalogEntry>();
  try {
    await database.execute(
      "CREATE TABLE IF NOT EXISTS packages (digest TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL, manifest TEXT NOT NULL)",
    );
    await database.execute(
      "CREATE TABLE IF NOT EXISTS active_looms (id TEXT PRIMARY KEY, digest TEXT NOT NULL)",
    );
    await database.execute(
      "CREATE TABLE IF NOT EXISTS installed_directories (digest TEXT PRIMARY KEY, path TEXT NOT NULL)",
    );
    const rows = await database.execute(
      "SELECT p.digest, p.name, p.version, p.manifest, d.path FROM packages p LEFT JOIN installed_directories d ON d.digest=p.digest ORDER BY p.digest",
    );
    for (const row of rows.rows) {
      const digest = String(row.digest);
      if (!/^[a-f0-9]{64}$/.test(digest))
        throw new PackageError("CATALOG_INVALID", "Invalid installed digest.");
      const manifest = parseManifest(JSON.parse(String(row.manifest)));
      if (manifest.id !== row.name || manifest.version !== row.version)
        throw new PackageError(
          "CATALOG_INVALID",
          "Installed identity differs from its catalog manifest.",
        );
      // The catalog stays readable when an artifact is missing; execution verifies the original bytes before dispatch.
      catalog.set(digest, {
        ref: {
          id: manifest.id,
          version: manifest.version,
          artifactDigest: digest,
        },
        manifest,
        artifactDir: row.path
          ? String(row.path)
          : join(dataDir, "packages", digest),
      });
    }
  } catch (error) {
    database.close();
    await lease.rollback();
    owner.close();
    throw error;
  }
  let closed = false;
  let tail = Promise.resolve();
  let closing: Promise<void> | undefined;
  const ensureOpen = () => {
    if (closed)
      throw new PackageError("SERVICE_CLOSED", "Package store is closed.");
  };
  return {
    installLoom(options) {
      ensureOpen();
      const operation = tail.then(async () => {
        const [primary, dependencies] = await Promise.all([
          readPackageSource(options.source),
          Promise.all((options.dependencySources ?? []).map(readPackageSource)),
        ]);
        const sources = [primary, ...dependencies];
        const root = primary.root;
        if (options.installedDirectory) {
          const item = primary.packages[0];
          if (!item.files.has("command.json"))
            throw new PackageError(
              "PACKAGE_INCOMPATIBLE",
              "Expected a compiled npm Loom command",
            );
          const artifactDir = resolve(options.source);
          const writes = [
            {
              sql: "INSERT OR REPLACE INTO packages(digest,name,version,manifest) VALUES (?,?,?,?)",
              args: [
                root.artifactDigest,
                root.id,
                root.version,
                stableJson(item.manifest),
              ],
            },
            {
              sql: "INSERT OR REPLACE INTO installed_directories(digest,path) VALUES (?,?)",
              args: [root.artifactDigest, artifactDir],
            },
          ];
          if (!options.snapshotOnly)
            writes.push({
              sql: "INSERT OR REPLACE INTO active_looms(id,digest) VALUES(?,?)",
              args: [root.id, root.artifactDigest],
            });
          await database.batch(writes, "write");
          catalog.set(root.artifactDigest, {
            ref: root,
            manifest: item.manifest,
            artifactDir,
          });
          return root;
        }
        if (
          options.expected &&
          (root.id !== options.expected.id ||
            (options.expected.version !== undefined &&
              root.version !== options.expected.version))
        )
          throw new PackageError(
            "PACKAGE_INCOMPATIBLE",
            "Downloaded archive differs from the requested identity.",
          );
        const supplied = new Map(
          sources
            .flatMap((source) => source.packages)
            .map((artifact) => [artifact.ref.artifactDigest, artifact]),
        );
        const entries = [...catalog.values(), ...supplied.values()];
        const graph = dependencyClosure([root], entries);
        const additions: LoomCatalogEntry[] = [];
        for (const artifact of graph) {
          if (catalog.has(artifact.ref.artifactDigest)) continue;
          // All non-installed members of the validated graph come from supplied sources.
          const source = artifact as PackageSource;
          const artifactDir = join(
            dataDir,
            "packages",
            source.ref.artifactDigest,
          );
          await mkdir(dirname(artifactDir), { recursive: true });
          const staging = await mkdtemp(join(dataDir, "packages/.install-"));
          try {
            for (const [path, bytes] of source.files) {
              const target = join(staging, path);
              await mkdir(dirname(target), { recursive: true });
              await writeFile(target, bytes);
            }
            // An unregistered directory can remain after interruption; validate it before reuse.
            await rename(staging, artifactDir).catch(
              async (error: NodeJS.ErrnoException) => {
                if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST")
                  throw error;
                const existing = await readPackageDirectory(artifactDir);
                if (stableJson(existing.ref) !== stableJson(source.ref))
                  throw new PackageError("INTEGRITY_MISMATCH", artifactDir);
              },
            );
          } finally {
            await rm(staging, { recursive: true, force: true });
          }
          additions.push({
            ref: source.ref,
            manifest: source.manifest,
            artifactDir,
          });
        }
        const statements = additions.map(({ ref, manifest }) => ({
          sql: "INSERT INTO packages (digest, name, version, manifest) VALUES (?, ?, ?, ?)",
          args: [ref.artifactDigest, ref.id, ref.version, stableJson(manifest)],
        }));
        if (!options.snapshotOnly)
          statements.push({
            sql: "INSERT OR REPLACE INTO active_looms(id,digest) VALUES (?,?)",
            args: [root.id, root.artifactDigest],
          });
        if (statements.length) await database.batch(statements, "write");
        for (const entry of additions)
          catalog.set(entry.ref.artifactDigest, entry);
        return structuredClone(root);
      });
      tail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    async removeDirect(id) {
      ensureOpen();
      await tail;
      const result = await database.execute({
        sql: "DELETE FROM active_looms WHERE id = ?",
        args: [id],
      });
      return result.rowsAffected > 0;
    },
    async listDirect() {
      await tail;
      const rows = await database.execute(
        "SELECT a.digest FROM active_looms a LEFT JOIN installed_directories d ON d.digest=a.digest WHERE d.path IS NULL ORDER BY a.id",
      );
      return rows.rows.map((row) => {
        const entry = catalog.get(String(row.digest));
        if (!entry)
          throw new PackageError("LOOM_NOT_FOUND", String(row.digest));
        return structuredClone(entry);
      });
    },
    async listLooms() {
      ensureOpen();
      await tail;
      return structuredClone(
        [...catalog.values()].sort((a, b) =>
          a.ref.artifactDigest.localeCompare(b.ref.artifactDigest),
        ),
      );
    },
    async getLoom(selector) {
      ensureOpen();
      await tail;
      const found = [...catalog.values()].filter(
        ({ ref }) =>
          ref.id === selector.id &&
          ref.version === selector.version &&
          (!selector.artifactDigest ||
            ref.artifactDigest === selector.artifactDigest),
      );
      const entry = found[0];
      if (!entry)
        throw new PackageError(
          "LOOM_NOT_FOUND",
          `${selector.id}@${selector.version}`,
        );
      if (found.length !== 1)
        throw new PackageError(
          "LOOM_AMBIGUOUS",
          "Select an exact artifact digest.",
        );
      return structuredClone(entry);
    },
    close() {
      closing ??= (async () => {
        closed = true;
        await tail;
        database.close();
        await lease.rollback();
        owner.close();
      })();
      return closing;
    },
  };
}
