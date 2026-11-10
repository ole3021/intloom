import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { satisfies } from "semver";
import {
  IntloomError,
  type InstalledLoomRef,
  type LoomDefinition,
  type LoomManifest,
} from "@intloom/loom-sdk";
import { stableJson } from "@intloom/loom-sdk/json";
import {
  dependencyClosure,
  inspectDefinition,
  PackageError,
} from "@intloom/loom-sdk/package-format";
import type { RunBinding } from "../lifecycle/run-contracts.ts";
import type { PackageStore } from "../packages/store.ts";
import { readPackageDirectory } from "../packages/source.ts";
import { runtimeVersions } from "./versions.ts";

export function runtimeBinding(
  manifest: Pick<LoomManifest, "components">,
): RunBinding["runtime"] {
  const usesMastra = Object.values(manifest.components).some(
    (component) => component.kind === "agent" || component.kind === "workflow",
  );
  return {
    version: runtimeVersions.kernel,
    nodeMajor: Number.parseInt(process.versions.node, 10),
    ...(usesMastra
      ? {
          kind: "mastra" as const,
          engineVersion: runtimeVersions.engine,
          storageVersion: runtimeVersions.storage,
        }
      : { kind: "code" as const }),
  };
}

export function createLoomLoader(packages: PackageStore) {
  const hostId = randomUUID();
  const loaded = new Map<
    string,
    Promise<{
      entry: LoomDefinition["entry"];
      check?: () => Promise<void>;
      manifest: LoomManifest;
      binding: Omit<RunBinding, "location">;
      resources: Map<string, Uint8Array>;
    }>
  >();
  return async function load(ref: InstalledLoomRef, directory?: string) {
    const key = JSON.stringify([ref.artifactDigest, directory]);
    let pending = loaded.get(key);
    if (!pending) {
      pending = (async () => {
        const artifactDir =
          directory ?? (await packages.getLoom(ref)).artifactDir;
        const artifact = await readPackageDirectory(artifactDir);
        if (stableJson(artifact.ref) !== stableJson(ref))
          throw new IntloomError(
            "PACKAGE_INCOMPATIBLE",
            "Installed artifact identity changed.",
          );
        const manifest = artifact.manifest;
        const catalog = await packages.listLooms();
        const dependencies = dependencyClosure(
          Object.values(manifest.dependencies),
          catalog,
        );
        const module = new URL(pathToFileURL(join(artifactDir, "runtime.mjs")));
        module.searchParams.set("host", hostId);
        module.searchParams.set("digest", ref.artifactDigest);
        let definition: LoomDefinition;
        let check: (() => Promise<void>) | undefined;
        try {
          const loadedModule = await import(module.href);
          definition = loadedModule.default as LoomDefinition;
          check = loadedModule.check;
        } catch {
          throw new IntloomError(
            "PACKAGE_INCOMPATIBLE",
            "Installed definition could not be loaded.",
          );
        }
        const descriptor = inspectDefinition(definition, manifest.build.target);
        const resources = Object.fromEntries(
          Object.entries(descriptor.resourcePaths).map(([id, path]) => [
            id,
            descriptor.manifest.resources[id] ?? {
              path: `resources/${id}/${path.split("/").at(-1)}`,
            },
          ]),
        );
        const actual = {
          ...descriptor.manifest,
          resources,
          dependencies: manifest.dependencies,
          build: manifest.build,
        };
        if (stableJson(actual) !== stableJson(manifest))
          throw new IntloomError(
            "PACKAGE_INCOMPATIBLE",
            "Loaded definition does not match its static manifest.",
          );
        if (
          Object.keys(descriptor.declarations).length &&
          Object.keys(descriptor.declarations).sort().join() !==
            Object.keys(manifest.dependencies).sort().join()
        )
          throw new IntloomError(
            "PACKAGE_INCOMPATIBLE",
            "Loaded dependency declarations do not match the package.",
          );
        for (const [alias, requirement] of Object.entries(
          descriptor.declarations,
        )) {
          const locked = manifest.dependencies[alias];
          if (
            !locked ||
            locked.id !== requirement.id ||
            !satisfies(locked.version, requirement.version)
          )
            throw new IntloomError(
              "PACKAGE_INCOMPATIBLE",
              "Loaded dependency requirements do not match the locked artifacts.",
            );
        }
        const binding: Omit<RunBinding, "location"> = {
          formatVersion: 1,
          loom: ref,
          dependencies: dependencies.map(({ ref }) => ref),
          entry: manifest.entry,
          runtime: runtimeBinding(manifest),
          config: {},
          ...(manifest.outcome ? { outcome: manifest.outcome } : {}),
        };
        return {
          entry: definition.entry,
          ...(check ? { check } : {}),
          manifest,
          binding,
          resources: new Map(
            Object.entries(manifest.resources).map(([id, resource]) => [
              id,
              artifact.files.get(resource.path) as Uint8Array,
            ]),
          ),
        };
      })();
      loaded.set(key, pending);
      pending.catch(() => loaded.delete(key));
    }
    const result = await pending.catch((error: unknown) => {
      if (error instanceof IntloomError) throw error;
      throw new IntloomError(
        error instanceof PackageError ? error.code : "PACKAGE_INCOMPATIBLE",
        "The installed Loom is unavailable or incompatible.",
        { artifactDigest: ref.artifactDigest },
      );
    });
    if (stableJson(result.binding.loom) !== stableJson(ref))
      throw new IntloomError(
        "LOOM_NOT_FOUND",
        "The exact installed Loom reference was not found.",
      );
    return result;
  };
}
