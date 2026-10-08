import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseDocument } from "yaml";
import {
  workflowDependenciesSchema,
  type WorkflowDependency,
} from "@intloom/kernel";
import { inspectFileStorageLock } from "@intloom/kernel/storage/file";
import { failure } from "../errors.ts";
import {
  acquireServiceLock,
  projectRoot,
  readServiceInfo,
} from "../service/discovery.ts";
import { diagnoseProject } from "../service/recovery.ts";
import {
  buildInstallation,
  inspectInstallation,
  workflowSource,
} from "./install.ts";

export interface InstalledWorkflowList {
  readonly projectRoot: string;
  readonly workflows: readonly WorkflowDependency[];
  readonly installation: "ready" | "repair_required" | "empty";
}

async function configuration(directory: string) {
  const root = await projectRoot(directory);
  const filename = join(root, "intloom.yaml");
  const info = await lstat(filename);
  if (!info.isFile())
    throw failure(
      "CLI_PROJECT_INVALID",
      "intloom.yaml must be an ordinary file, not a symlink.",
    );
  const original = await readFile(filename, "utf8");
  const document = parseDocument(original, {
    uniqueKeys: true,
    version: "1.2",
    prettyErrors: false,
  });
  try {
    if (document.errors.length || document.warnings.length)
      throw new Error("Invalid YAML");
    const value: unknown = document.toJS({ maxAliasCount: 0 });
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Expected mapping");
    const workflows = workflowDependenciesSchema.parse(
      "workflows" in value ? value.workflows : [],
    );
    return {
      root,
      filename,
      original,
      document,
      workflows,
      mode: info.mode & 0o777,
    };
  } catch (cause) {
    throw failure(
      "INVALID_REQUEST",
      "Check intloom.yaml YAML syntax and Workflow declarations. No configuration was changed.",
      cause,
    );
  }
}

export async function listInstalledWorkflows(
  directory: string,
): Promise<InstalledWorkflowList> {
  const config = await configuration(directory);
  return {
    projectRoot: config.root,
    workflows: config.workflows,
    installation: await inspectInstallation(config.root, config.workflows),
  };
}

async function change(
  directory: string,
  select: (current: readonly WorkflowDependency[]) => {
    sources: string[];
    expected: (WorkflowDependency | undefined)[];
  },
): Promise<InstalledWorkflowList> {
  const root = await projectRoot(directory);
  const diagnosis = await diagnoseProject(root);
  if (diagnosis.status !== "offline")
    throw failure(
      "CLI_SERVICE_BUSY",
      "Stop the project service before changing Workflows. For stale resources, run intloom doctor and recover first.",
    );
  const release = await acquireServiceLock(root, randomUUID());
  try {
    if (
      (await readServiceInfo(root)) ||
      (await inspectFileStorageLock({ directory: join(root, "intloom") }))
    )
      throw failure(
        "CLI_SERVICE_BUSY",
        "Project resources are still present. Run intloom doctor before changing Workflows.",
      );
    const config = await configuration(root);
    const selected = select(config.workflows);
    const workflows = await buildInstallation(
      root,
      selected.sources,
      selected.expected,
      async (next) => {
        config.document.set("workflows", next);
        const temporary = join(
          root,
          ".intloom",
          `configuration-${randomUUID()}.tmp`,
        );
        try {
          const file = await open(temporary, "wx", config.mode);
          try {
            await file.writeFile(config.document.toString());
            await file.sync();
          } finally {
            await file.close();
          }
          if (
            !(await lstat(config.filename)).isFile() ||
            (await readFile(config.filename, "utf8")) !== config.original
          )
            throw failure(
              "CONFLICT",
              "intloom.yaml changed during installation. The concurrent edit was preserved; retry using the new configuration.",
            );
          await rename(temporary, config.filename);
        } finally {
          await rm(temporary, { force: true }).catch(() => {});
        }
      },
    );
    return {
      projectRoot: root,
      workflows,
      installation: workflows.length ? "ready" : "empty",
    };
  } finally {
    await release();
  }
}

function sourceOf(root: string, dependency: WorkflowDependency) {
  return dependency.source
    ? resolve(root, dependency.source)
    : `${dependency.name}@${dependency.version}`;
}

export async function addWorkflow(
  projectDirectory: string,
  source: string,
): Promise<InstalledWorkflowList> {
  const root = await projectRoot(projectDirectory);
  const selected = workflowSource(source, process.cwd());
  return change(root, (current) => ({
    sources: [...current.map((item) => sourceOf(root, item)), selected],
    expected: [...current, undefined],
  }));
}

export async function removeWorkflow(
  projectDirectory: string,
  packageName: string,
): Promise<InstalledWorkflowList> {
  const root = await projectRoot(projectDirectory);
  return change(root, (current) => {
    if (!current.some((item) => item.name === packageName))
      throw failure(
        "NOT_FOUND",
        `Workflow package ${packageName} is not declared. Use intloom workflow list for package names.`,
      );
    const remaining = current.filter((item) => item.name !== packageName);
    return {
      sources: remaining.map((item) => sourceOf(root, item)),
      expected: [...remaining],
    };
  });
}
