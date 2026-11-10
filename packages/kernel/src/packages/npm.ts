import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { list } from "tar";
import { satisfies } from "semver";
import { parse } from "yaml";
import { authorManifest } from "@intloom/loom-sdk/package-format";

export async function readNpmLoom(directory: string) {
  const yaml = await readFile(join(directory, "loom.yaml"), "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined;
      throw error;
    },
  );
  if (yaml === undefined) return undefined;
  const metadata = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  return {
    directory,
    name: String(metadata.name),
    version: String(metadata.version),
    manifest: authorManifest.parse(parse(yaml)),
  };
}
export async function locateNpmLoom(
  name: string,
  globalRoot: string,
  project?: string,
) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name))
    return undefined;
  if (project) {
    let current = resolve(project);
    for (;;) {
      const found = await readNpmLoom(join(current, "node_modules", name));
      if (found) return { ...found, global: false };
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  const found = await readNpmLoom(join(globalRoot, name));
  return found ? { ...found, global: true } : undefined;
}
export async function npmArchiveName(source: string) {
  const info = await stat(source).catch(() => undefined);
  if (!info) return undefined;
  if (info.isDirectory()) return (await readNpmLoom(source))?.name;
  let yaml = false,
    metadata = "";
  await list({
    file: source,
    onReadEntry(entry) {
      if (entry.path === "package/loom.yaml") yaml = true;
      if (entry.path === "package/package.json")
        entry.on("data", (data: Buffer) => {
          metadata += data.toString();
        });
    },
  });
  return yaml ? String(JSON.parse(metadata).name) : undefined;
}

export function runNpm(
  args: string[],
  cwd = process.cwd(),
): Promise<{ stdout: string; stderr: string }> {
  const cli =
    process.env.INTLOOM_NPM_CLI ??
    (process.platform === "win32"
      ? join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")
      : undefined);
  return promisify(execFile)(
    cli ? process.execPath : "npm",
    cli ? [cli, ...args] : args,
    { cwd, maxBuffer: 4194304 },
  );
}

export async function npmRoot(global: boolean, cwd = process.cwd()) {
  const { stdout } = await runNpm(["root", ...(global ? ["-g"] : [])], cwd);
  return stdout.trim();
}
export async function listGlobalPackages(root: string) {
  const dirs = await readdir(root, { withFileTypes: true }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return [];
      throw err;
    },
  );
  const names: string[] = [];
  for (const entry of dirs) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      for (const child of await readdir(join(root, entry.name)))
        names.push(`${entry.name}/${child}`);
    } else names.push(entry.name);
  }
  return (
    await Promise.all(names.map((name) => readNpmLoom(join(root, name))))
  ).filter((p) => p !== undefined);
}

/** Validate installed runtime dependencies without installing or importing business code. */
export async function checkInstalledTree(
  directory: string,
  globalRoot: string,
  project?: string,
) {
  const checked = new Set<string>();
  async function visit(
    path: string,
    parents: readonly string[],
  ): Promise<void> {
    const pkg = await readNpmLoom(path);
    if (!pkg) throw new Error(`Missing installed Loom: ${path}`);
    if (parents.includes(pkg.name))
      throw new Error(
        `Circular Loom dependency: ${[...parents, pkg.name].join(" → ")}`,
      );
    if (checked.has(path)) return;
    const metadata = JSON.parse(
      await readFile(join(path, "package.json"), "utf8"),
    );
    for (const name of Object.keys(metadata.dependencies ?? {})) {
      let at = path,
        available = false;
      while (!available) {
        available = await stat(
          join(at, "node_modules", name, "package.json"),
        ).then(
          (s) => s.isFile(),
          () => false,
        );
        const parent = dirname(at);
        if (parent === at) break;
        at = parent;
      }
      if (!available)
        throw new Error(`${pkg.name} requires npm dependency ${name}`);
    }
    const isGlobal = path === join(globalRoot, pkg.name);
    for (const [name, range] of Object.entries(pkg.manifest.looms ?? {})) {
      const child = await locateNpmLoom(
        name,
        globalRoot,
        project ?? (isGlobal ? undefined : dirname(path)),
      );
      if (!child || !satisfies(child.version, range))
        throw new Error(
          pkg.name +
            " requires " +
            name +
            "@" +
            range +
            "; installed: " +
            (child?.version ?? "missing"),
        );
      await visit(child.directory, [...parents, pkg.name]);
    }
    checked.add(path);
  }
  await visit(directory, []);
}
