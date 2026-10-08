import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { getLogger } from "@intloom/utils";
import { isDeepStrictEqual } from "node:util";
import {
  workflowDependenciesSchema,
  type WorkflowDependency,
} from "@intloom/kernel";
import { discoverWorkflows } from "@intloom/kernel/workflow";
import { failure } from "../errors.ts";

const execute = promisify(execFile);
const packageSpec =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[^\s/:]+)?$/;

export function workflowSource(input: string, cwd: string) {
  if (input.endsWith(".tgz")) return resolve(cwd, input);
  if (!packageSpec.test(input))
    throw failure(
      "INVALID_REQUEST",
      "Workflow sources must be npm package names, package@version, or local .tgz files.",
    );
  const versionSeparator = input.indexOf("@", 1);
  return versionSeparator < 0 ? `${input}@latest` : input;
}

async function npm(args: readonly string[], cwd: string) {
  try {
    const result = await execute(
      process.platform === "win32" ? "npm.cmd" : "npm",
      [...args],
      {
        cwd,
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    return result.stdout;
  } catch (cause) {
    throw failure(
      "CLI_WORKFLOW_INSTALL_FAILED",
      "Cannot install Workflow packages. Check npm availability, package/version, archive paths, registry access and dependency availability. Installation scripts are disabled.",
      cause,
    );
  }
}

async function pack(
  source: string,
  directory: string,
): Promise<{ dependency: WorkflowDependency; filename: string }> {
  const output = JSON.parse(
    await npm(
      [
        "pack",
        source,
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        directory,
      ],
      directory,
    ),
  );
  const result = output[0];
  if (
    typeof result?.filename !== "string" ||
    result.filename.includes("/") ||
    result.filename.includes("\\")
  )
    throw failure(
      "CLI_WORKFLOW_INSTALL_FAILED",
      "npm returned an invalid archive filename.",
    );
  const filename = join(directory, result.filename);
  const sha256 = createHash("sha256")
    .update(await readFile(filename))
    .digest("hex");
  const [dependency] = workflowDependenciesSchema.parse([
    {
      name: result.name,
      version: result.version,
      sha256,
      ...(isAbsolute(source) ? { source } : {}),
    },
  ]);
  if (!dependency)
    throw failure(
      "CLI_WORKFLOW_INSTALL_FAILED",
      "npm did not return a package.",
    );
  return { dependency, filename };
}

// Detect damaged or edited installations before importing executable modules.
async function treeHash(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(relative: string) {
    const filename = join(root, relative);
    const info = await lstat(filename);
    hash.update(
      JSON.stringify([
        relative,
        info.isDirectory() ? "dir" : info.isSymbolicLink() ? "link" : "file",
      ]),
    );
    if (info.isDirectory()) {
      for (const name of (await readdir(filename)).sort())
        await walk(join(relative, name));
    } else if (info.isSymbolicLink())
      hash.update(JSON.stringify(await readlink(filename)));
    else if (info.isFile())
      hash.update(
        createHash("sha256")
          .update(await readFile(filename))
          .digest("hex"),
      );
    else throw new Error("Unexpected installation entry");
  }
  await walk("node_modules");
  return hash.digest("hex");
}

export async function installWorkflows(
  root: string,
  sources: readonly string[],
): Promise<WorkflowDependency[]> {
  return buildInstallation(root, sources);
}

/** Checks the entire installed tree without importing Workflow code or repairing it. */
export async function inspectInstallation(
  root: string,
  dependencies: readonly WorkflowDependency[],
): Promise<"ready" | "repair_required" | "empty"> {
  const destination = join(root, ".intloom/workflows");
  try {
    if (!(await lstat(join(root, ".intloom"))).isDirectory())
      return "repair_required";
    if (!(await lstat(destination)).isDirectory()) return "repair_required";
    const saved = JSON.parse(
      await readFile(join(destination, "installed.json"), "utf8"),
    );
    return isDeepStrictEqual(saved.workflows, dependencies) &&
      saved.treeHash === (await treeHash(destination))
      ? dependencies.length
        ? "ready"
        : "empty"
      : "repair_required";
  } catch {
    if (!dependencies.length) {
      const entries = await readdir(destination).catch(() => undefined);
      if (entries?.length === 0) return "empty";
      const local = await lstat(join(root, ".intloom")).catch(() => undefined);
      if (!local) return "empty";
    }
    return "repair_required";
  }
}

export async function ensureWorkflows(
  root: string,
  dependencies: readonly WorkflowDependency[],
) {
  getLogger().debug("workflow_installation_check", {
    packageCount: dependencies.length,
  });
  const destination = join(root, ".intloom/workflows");
  const info = await lstat(destination).catch((cause: unknown) => {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return undefined;
    throw cause;
  });
  if (info && !info.isDirectory())
    throw failure(
      "CLI_PROJECT_INVALID",
      "The Workflow installation must be an ordinary directory.",
    );
  if ((await inspectInstallation(root, dependencies)) !== "repair_required")
    return;
  getLogger().info("workflow_restoration_started", {
    packageCount: dependencies.length,
  });
  await buildInstallation(
    root,
    dependencies.map((item) =>
      item.source ? resolve(root, item.source) : `${item.name}@${item.version}`,
    ),
    dependencies,
  );
  getLogger().info("workflow_restoration_completed", {
    packageCount: dependencies.length,
  });
}

/** Caller serializes mutations with the service lock; YAML remains authoritative after a crash. */
export async function buildInstallation(
  root: string,
  sources: readonly string[],
  expected?: readonly (WorkflowDependency | undefined)[],
  publishConfiguration?: (dependencies: WorkflowDependency[]) => Promise<void>,
) {
  const local = join(root, ".intloom");
  await mkdir(local, { recursive: true, mode: 0o700 });
  if (!(await lstat(local)).isDirectory())
    throw failure(
      "CLI_PROJECT_INVALID",
      "The local installation directory must not be a symlink.",
    );
  const stage = await mkdtemp(join(local, "workflows-install-"));
  const destination = join(local, "workflows");
  const backup = `${stage}-previous`;
  let moved = false;
  try {
    const archives = join(stage, "archives");
    await mkdir(archives);
    const dependencies: WorkflowDependency[] = [];
    const packages: Record<string, string> = {};
    for (const [index, source] of sources.entries()) {
      const packed = await pack(source, archives);
      const declared = expected?.[index];
      if (
        declared &&
        (declared.name !== packed.dependency.name ||
          declared.version !== packed.dependency.version ||
          declared.sha256 !== packed.dependency.sha256)
      )
        throw failure(
          "CLI_WORKFLOW_INTEGRITY_FAILED",
          `Workflow archive does not match intloom.yaml: ${declared.name}.`,
        );
      dependencies.push(declared ?? packed.dependency);
      if (
        dependencies.some(
          (item, position) =>
            position !== index && item.name === packed.dependency.name,
        )
      )
        throw failure(
          "CONFLICT",
          `Workflow ${packed.dependency.name} is already declared. Remove it before installing another version.`,
        );
      const filename = `workflow-${index}.tgz`;
      await rename(packed.filename, join(archives, filename));
      packages[packed.dependency.name] = `file:archives/${filename}`;
    }
    workflowDependenciesSchema.parse(dependencies);
    await writeFile(
      join(stage, "package.json"),
      JSON.stringify({ private: true, type: "module", dependencies: packages }),
    );
    if (sources.length)
      await npm(
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--omit=dev",
        ],
        stage,
      );
    else await mkdir(join(stage, "node_modules"));
    const discovered = await discoverWorkflows(stage, dependencies);
    if (
      discovered.failures.length ||
      discovered.sources.length !== dependencies.length
    )
      throw failure(
        "CLI_WORKFLOW_PACKAGE_INVALID",
        "An installed package is not a compatible compiled IntLoom Workflow.",
      );
    await writeFile(
      join(stage, "installed.json"),
      JSON.stringify({
        workflows: dependencies,
        treeHash: await treeHash(stage),
      }),
    );
    const old = await lstat(destination).catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return undefined;
      throw cause;
    });
    if (old && !old.isDirectory())
      throw failure(
        "CLI_PROJECT_INVALID",
        "The Workflow installation must be an ordinary directory.",
      );
    if (old) {
      await rename(destination, backup);
      moved = true;
    }
    let published = false;
    try {
      await rename(stage, destination);
      published = true;
      await publishConfiguration?.(dependencies);
    } catch (cause) {
      // Publication failed before the YAML commit; put the prior installation back.
      if (published) await rm(destination, { recursive: true, force: true });
      if (moved) {
        await rename(backup, destination);
        moved = false;
      }
      throw cause;
    }
    // The configuration is committed; leftover disposable files do not make it a failed mutation.
    if (moved)
      await rm(backup, { recursive: true, force: true }).catch(() => {});
    return dependencies;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
