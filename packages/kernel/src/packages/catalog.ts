import {
  IntloomError,
  type InstalledLoomRef,
  type LoomSelector,
  type PageOptions,
} from "@intloom/loom-sdk";
import { dependencyClosure } from "@intloom/loom-sdk/package-format";
import type { PackageStore } from "./store.ts";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { listGlobalPackages, npmRoot, readNpmLoom } from "./npm.ts";
import type { LoomCatalogEntry } from "@intloom/loom-sdk";
import { page } from "../query.ts";

export function createLoomCatalog(packages: PackageStore) {
  let globalRoot: Promise<string> | undefined;
  const root = () => (globalRoot ??= npmRoot(true));
  type NpmLoom = NonNullable<Awaited<ReturnType<typeof readNpmLoom>>>;
  function defaultCommandEntry(pkg: NpmLoom) {
    const entry = Object.entries(pkg.manifest.commands).find(
      ([name]) =>
        !pkg.manifest.defaultCommand || name === pkg.manifest.defaultCommand,
    );
    if (!entry)
      throw new IntloomError(
        "LOOM_NOT_FOUND",
        "The default Loom command was not found.",
      );
    return entry;
  }
  async function commandEntry(pkg: NpmLoom, command?: string) {
    const [defaultCommand] = defaultCommandEntry(pkg);
    const selected = command ?? defaultCommand;
    const spec = pkg.manifest.commands[selected];
    if (!spec)
      throw new IntloomError("LOOM_NOT_FOUND", `Unknown command: ${selected}`);
    const dir = dirname(join(pkg.directory, spec.entry));
    const ref = await packages.installLoom({
      source: dir,
      installedDirectory: true,
      snapshotOnly: true,
    });
    const entry = await packages.getLoom(ref);
    return {
      ...entry,
      commands: pkg.manifest.commands,
      defaultCommand,
      manifest: {
        ...entry.manifest,
        contracts: { ...entry.manifest.contracts, input: spec.input },
      },
    };
  }
  return {
    async getLoom(selector: LoomSelector) {
      if (
        !("artifactDigest" in selector) &&
        "id" in selector &&
        /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(selector.id)
      ) {
        const pkg = await readNpmLoom(join(await root(), selector.id));
        if (pkg && (!selector.version || selector.version === pkg.version)) {
          const { ref, manifest, commands, defaultCommand } =
            await commandEntry(pkg, selector.command);
          return { ref, manifest, commands, defaultCommand };
        }
      }
      const exact = "artifactDigest" in selector;
      const entries = exact
        ? await packages.listLooms()
        : await packages.listDirect();
      const entry = entries.find(
        ({ ref }) =>
          (!exact || ref.artifactDigest === selector.artifactDigest) &&
          (!("id" in selector) ||
            (ref.id === selector.id &&
              (!selector.version || ref.version === selector.version))),
      );
      if (!entry)
        throw new IntloomError(
          "LOOM_NOT_FOUND",
          "Loom was not found in the Intloom package store.",
        );
      return { ref: entry.ref, manifest: entry.manifest };
    },
    async listLooms(options: PageOptions & { readonly id?: string } = {}) {
      const direct = await packages.listDirect();
      const npmPackages = await listGlobalPackages(await root());
      const all = new Map<string, LoomCatalogEntry>();
      // Linked npm commands are discovered from the current npm root, including external uninstalls.
      for (const entry of direct) all.set(entry.ref.id, entry);
      for (const pkg of npmPackages) {
        const [, command] = defaultCommandEntry(pkg);
        const dir = dirname(join(pkg.directory, command.entry));
        const [identity, descriptor] = await Promise.all([
          readFile(join(dir, "integrity.json"), "utf8"),
          readFile(join(dir, "loom.json"), "utf8"),
        ]);
        all.set(pkg.name, {
          ref: {
            id: pkg.name,
            version: pkg.version,
            artifactDigest: JSON.parse(identity).artifactDigest,
          },
          manifest: JSON.parse(descriptor),
          artifactDir: dir,
        });
      }
      const entries = [...all.values()]
        .filter(({ ref }) => !options.id || ref.id === options.id)
        .map(({ ref, manifest }) => ({
          ref,
          name: manifest.name,
          source: "intloom" as const,
          active: true,
          description: manifest.description,
          entry: manifest.entry,
        }));
      return page(
        entries,
        (e) => e.ref.artifactDigest,
        { id: options.id },
        options,
      );
    },
    async getLoomCatalog(locked?: readonly InstalledLoomRef[]) {
      const roots =
        locked ?? (await packages.listDirect()).map((item) => item.ref);
      return dependencyClosure(roots, await packages.listLooms());
    },
  };
}
