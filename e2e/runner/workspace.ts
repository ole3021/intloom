import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod";
import { E2eError, type Options } from "./contracts.ts";
import { repositoryRoot } from "./options.ts";
import { processResult } from "./commands.ts";
import { digest } from "./cases.ts";
import type { Evidence } from "./evidence.ts";

const manifestSchema = z.looseObject({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  peerDependenciesMeta: z
    .record(z.string(), z.object({ optional: z.boolean().optional() }))
    .optional(),
  files: z.array(z.string()).optional(),
});
type Manifest = z.infer<typeof manifestSchema>;
interface CandidatePackage {
  source: string;
  content: string;
  directory: string;
  archive: string;
  manifest: Manifest;
  workspace: boolean;
  dependencies: Record<string, CandidatePackage>;
  optional: Set<string>;
}

/** Preserve the built Workflow and its installed runtime graph without registry resolution. */
export async function snapshotWorkflow(
  sourceManifest: string,
  compiledDirectory: string,
  directory: string,
  evidence: Evidence,
  signal?: AbortSignal,
  environment: NodeJS.ProcessEnv = process.env,
  sourceRoot = repositoryRoot,
) {
  const root = join(directory, "workspace-candidate");
  const archives = join(root, "archives");
  await mkdir(archives, { recursive: true, mode: 0o700 });
  const packages = new Map<string, CandidatePackage>();
  const workspaceRoot = await realpath(sourceRoot);
  const original = await realpath(sourceManifest);
  async function visit(source: string): Promise<CandidatePackage> {
    signal?.throwIfAborted();
    source = await realpath(source);
    const existing = packages.get(source);
    if (existing) return existing;
    const isRoot = source === original;
    const manifest = manifestSchema.parse(
      JSON.parse(
        await readFile(
          isRoot ? join(compiledDirectory, "package.json") : source,
          "utf8",
        ),
      ),
    );
    const local = relative(workspaceRoot, source);
    const workspace =
      isRoot ||
      local.startsWith(`packages${sep}`) ||
      local.startsWith(`apps${sep}`);
    if (manifest.name.startsWith("@intloom/") && !workspace)
      throw new E2eError(
        "WORKSPACE_DEPENDENCY_MISSING",
        `The installed ${manifest.name} dependency does not resolve to the current workspace. Run bun install --frozen-lockfile.`,
        "environment",
        "blocked",
      );
    const id = `package-${String(packages.size).padStart(3, "0")}`;
    const item: CandidatePackage = {
      source,
      content: isRoot ? compiledDirectory : dirname(source),
      directory: join(root, "packages", id),
      archive: join(archives, `${id}.tgz`),
      manifest,
      workspace,
      dependencies: {},
      optional: new Set(),
    };
    packages.set(source, item);
    const required = { ...manifest.dependencies, ...manifest.peerDependencies };
    for (const [name, range] of Object.entries({
      ...required,
      ...manifest.optionalDependencies,
    })) {
      const optional =
        Object.hasOwn(manifest.optionalDependencies ?? {}, name) ||
        (!Object.hasOwn(manifest.dependencies ?? {}, name) &&
          manifest.peerDependenciesMeta?.[name]?.optional === true);
      let resolved: string | undefined;
      try {
        resolved = findPackageJSON(name, pathToFileURL(source));
      } catch {
        /* Missing optional packages stay absent, as in this installed workspace. */
      }
      if (!resolved) {
        if (optional) continue;
        throw new E2eError(
          "WORKSPACE_DEPENDENCY_MISSING",
          `The installed runtime dependency ${name}@${range} is missing. Run bun install --frozen-lockfile.`,
          "environment",
          "blocked",
        );
      }
      item.dependencies[name] = await visit(resolved);
      if (optional) item.optional.add(name);
    }
    return item;
  }
  const workflow = await visit(original);
  const identities = [];
  for (const item of packages.values()) {
    signal?.throwIfAborted();
    await mkdir(item.directory, { recursive: true, mode: 0o700 });
    if (item === workflow || !item.workspace)
      await cp(item.content, item.directory, {
        recursive: true,
        dereference: true,
        filter: (path) =>
          !["node_modules", ".git", ".npmrc"].includes(basename(path)) &&
          !/^\.env(?:\.|$)/u.test(basename(path)),
      });
    else {
      const paths = item.manifest.files ?? ["dist"];
      for (const path of paths) {
        const target = resolve(item.content, path);
        const local = relative(item.content, target);
        if (!local || local.startsWith("..") || /[*?]/u.test(path))
          throw new E2eError(
            "WORKSPACE_PACKAGE_INVALID",
            `The current workspace package ${item.manifest.name} needs concrete package file paths.`,
            "environment",
            "blocked",
          );
        const info = await lstat(target).catch(() => undefined);
        if (info)
          await cp(target, resolve(item.directory, path), {
            recursive: true,
            dereference: true,
          });
      }
    }
    const manifest: Record<string, unknown> = { ...item.manifest };
    for (const key of [
      "scripts",
      "devDependencies",
      "peerDependencies",
      "peerDependenciesMeta",
      "bundledDependencies",
      "bundleDependencies",
      "publishConfig",
    ])
      delete manifest[key];
    manifest.dependencies = {};
    manifest.optionalDependencies = {};
    for (const [name, dependency] of Object.entries(item.dependencies))
      (
        manifest[
          item.optional.has(name) ? "optionalDependencies" : "dependencies"
        ] as Record<string, string>
      )[name] = `file:${dependency.archive}`;
    await writeFile(
      join(item.directory, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { mode: 0o600 },
    );
    const packed = await processResult(
      "npm",
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        archives,
        "--cache",
        join(directory, ".npm-cache"),
      ],
      item.directory,
      30000,
      signal,
      environment,
    );
    await evidence.event("workspace_package", {
      name: item.manifest.name,
      version: item.manifest.version,
      code: packed.code,
      stderr: packed.stderr,
    });
    if (packed.code)
      throw new E2eError(
        "WORKSPACE_PACK_FAILED",
        `Cannot prepare the local ${item.manifest.name} runtime package. See workspace-package evidence.`,
        "environment",
        "blocked",
      );
    const filename = z
      .array(z.object({ filename: z.string() }))
      .parse(JSON.parse(packed.stdout))[0]?.filename;
    if (!filename || basename(filename) !== filename)
      throw new E2eError(
        "WORKSPACE_PACK_FAILED",
        "npm did not return a valid local package archive.",
        "environment",
        "blocked",
      );
    await rename(join(archives, filename), item.archive);
    identities.push({
      name: item.manifest.name,
      version: item.manifest.version,
      source: item.source,
      workspace: item.workspace,
      archive: item.archive,
      digest: digest(await readFile(item.archive)),
      dependencies: Object.fromEntries(
        Object.entries(item.dependencies).map(([name, dependency]) => [
          name,
          dependency.archive,
        ]),
      ),
    });
  }
  const candidate = {
    source: "workspace",
    archive: workflow.archive,
    packages: identities,
  };
  await evidence.save("workspace-candidate.json", candidate);
  await rm(join(root, "packages"), { recursive: true, force: true });
  return candidate;
}

export async function prepareWorkspaceWorkflow(
  options: Options,
  directory: string,
  evidence: Evidence,
  signal: AbortSignal,
  environment: NodeJS.ProcessEnv,
) {
  const source = join(directory, "workspace-source");
  await mkdir(source, { recursive: true });
  for (const name of [
    "package.json",
    "bun.lock",
    "turbo.json",
    "tsconfig.base.json",
    "LICENSE",
    "scripts",
    "packages",
    "apps",
    "e2e",
  ])
    await cp(join(repositoryRoot, name), join(source, name), {
      recursive: true,
      filter: (path) =>
        ![
          ".git",
          "node_modules",
          "dist",
          ".publish",
          ".publish-intloom",
          ".turbo",
          ".intloom",
          ".DS_Store",
        ].includes(basename(path)) &&
        !/^\.env(?:\.|$)/u.test(basename(path)) &&
        !basename(path).startsWith("e2e-") &&
        path !== directory,
    });
  // Reuse installed dependencies; workspace links point to this isolated source copy.
  async function linkModules(original: string, target: string) {
    const names = await readdir(original).catch(() => []);
    await mkdir(target, { recursive: true });
    for (const name of names) {
      if (name.startsWith("@")) {
        await linkModules(join(original, name), join(target, name));
        continue;
      }
      const origin = join(original, name);
      const resolved = await realpath(origin);
      const local = relative(repositoryRoot, resolved);
      const link =
        !local.startsWith("..") &&
        (local.startsWith(`packages${sep}`) || local.startsWith(`apps${sep}`))
          ? join(source, local)
          : resolved;
      await symlink(link, join(target, name));
    }
  }
  await linkModules(
    join(repositoryRoot, "node_modules"),
    join(source, "node_modules"),
  );
  for (const parent of ["packages", "apps", "e2e"]) {
    const directories =
      parent === "e2e" ? [""] : await readdir(join(repositoryRoot, parent));
    for (const name of directories) {
      if (!(await lstat(join(repositoryRoot, parent, name))).isDirectory())
        continue;
      await linkModules(
        join(repositoryRoot, parent, name, "node_modules"),
        join(source, parent, name, "node_modules"),
      );
    }
  }
  const workflowRoot = options.workspacePackage;
  const workflowManifest =
    options.workspaceWorkflow && workflowRoot
      ? manifestSchema.parse(
          JSON.parse(
            await readFile(join(workflowRoot, "package.json"), "utf8"),
          ),
        )
      : undefined;
  const workflowRelative = workflowRoot
    ? relative(repositoryRoot, workflowRoot)
    : undefined;
  if (
    options.workspaceWorkflow &&
    (!workflowRelative || workflowRelative.startsWith(".."))
  )
    throw new E2eError(
      "WORKSPACE_SOURCE_INVALID",
      "The current source must be a package inside this checkout. Use --workflow with an archive or published package for external packages.",
      "environment",
      "blocked",
    );
  const args = [
    "run",
    "build",
    ...(workflowManifest ? [`--filter=${workflowManifest.name}...`] : []),
    ...(options.cli === resolve(repositoryRoot, "apps/cli/dist/bin.js")
      ? ["--filter=@intloom/cli..."]
      : []),
    "--concurrency=1",
    "--cache=local:rw",
  ];
  await evidence.event("workspace_build_started", { args });
  const built = await processResult(
    "bun",
    args,
    source,
    120000,
    signal,
    environment,
  );
  await evidence.event("workspace_build", { args, ...built });
  signal.throwIfAborted();
  if (built.code)
    throw new E2eError(
      "WORKSPACE_BUILD_FAILED",
      "The isolated current CLI/Workflow build failed. See workspace-build evidence.",
      "environment",
      "blocked",
    );
  const cli =
    options.cli === resolve(repositoryRoot, "apps/cli/dist/bin.js")
      ? join(source, "apps/cli/dist/bin.js")
      : options.cli;
  if (!options.workspaceWorkflow)
    return { archive: options.workflow, cli, packages: [] };
  if (!workflowRelative)
    throw new E2eError(
      "WORKSPACE_SOURCE_INVALID",
      "A current source package is required.",
      "environment",
      "blocked",
    );
  const candidate = await snapshotWorkflow(
    join(source, workflowRelative, "package.json"),
    join(source, workflowRelative, "dist"),
    directory,
    evidence,
    signal,
    environment,
    source,
  );
  return { ...candidate, cli };
}
