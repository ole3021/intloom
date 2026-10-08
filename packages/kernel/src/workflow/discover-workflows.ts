import { readFile, realpath, stat } from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { LoomError } from "@intloom/utils";
import type { WorkflowDependency } from "../core/schemas/loom-config.ts";
import * as z from "zod";
import { fail, workflowError } from "./errors.ts";
import {
  workflowMetadataSchema,
  workflowProtocolVersion,
} from "./schemas/package-metadata.ts";
import type {
  WorkflowDiscoveryResult,
  WorkflowInitializationFailure,
  WorkflowPackage,
} from "./types.ts";

const projectSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
});
const packageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  type: z.literal("module"),
  intloom: workflowMetadataSchema,
  exports: z.object({
    ".": z.strictObject({
      types: z.string().min(1),
      default: z.string().min(1),
      import: z.string().min(1).optional(),
    }),
    "./package.json": z.literal("./package.json"),
  }),
});

function inside(root: string, file: string): boolean {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

/** Inspects direct dependencies independently; package failures are recorded and skipped, while project-file failures propagate. */
export async function discoverWorkflows(
  projectRoot: string,
  declared?: readonly WorkflowDependency[],
): Promise<WorkflowDiscoveryResult> {
  const projectFile = resolve(projectRoot, "package.json");
  const base = pathToFileURL(projectFile);
  const require = createRequire(base);
  const sources: WorkflowPackage[] = [];
  const failures: WorkflowInitializationFailure[] = [];
  const seen = new Set<string>();
  try {
    const project = declared
      ? {
          dependencies: Object.fromEntries(
            declared.map((item) => [item.name, item.version]),
          ),
        }
      : projectSchema.parse(JSON.parse(await readFile(projectFile, "utf8")));
    for (const name of Object.keys(project.dependencies ?? {})) {
      try {
        // Ordinary dependencies may not export package.json; locate metadata through Node without loading their modules.
        const file = findPackageJSON(name, base);
        if (!file)
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Dependency is not installed: ${name}`,
          );
        const raw: unknown = JSON.parse(await readFile(file, "utf8"));
        if (!raw || typeof raw !== "object" || !("intloom" in raw)) {
          if (declared)
            fail("INVALID_WORKFLOW_PACKAGE", `Not a Workflow package: ${name}`);
          continue;
        }
        const parsed = packageSchema.safeParse(raw);
        if (!parsed.success)
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Invalid Workflow package: ${name}`,
            parsed.error,
          );
        const manifest = parsed.data;
        if (
          declared &&
          (manifest.name !== name ||
            manifest.version !== project.dependencies?.[name])
        )
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Installed Workflow does not match its declaration: ${name}`,
          );
        if (manifest.intloom.version !== workflowProtocolVersion) {
          fail(
            "UNSUPPORTED_WORKFLOW_PROTOCOL",
            `Unsupported Workflow protocol for ${name}: ${manifest.intloom.version}`,
          );
        }
        // The Workflow protocol exports a metadata entry; verify that it points to the same actual manifest.
        const metadataFile = await realpath(file);
        if (
          (await realpath(require.resolve(`${name}/package.json`))) !==
          metadataFile
        ) {
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Workflow metadata entry mismatch: ${name}`,
          );
        }
        if (seen.has(metadataFile)) continue;
        const packageRoot = dirname(metadataFile);
        const entry = manifest.exports["."];
        // The Compiler protocol supports only types/default/import; import and default must match.
        if (entry.import && entry.import !== entry.default) {
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Workflow import/default entries differ: ${name}`,
          );
        }
        if (
          !entry.default.startsWith("./") ||
          !/\.(?:js|mjs)$/.test(entry.default)
        ) {
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Workflow entry must be compiled ESM: ${name}`,
          );
        }
        const entryFile = await realpath(resolve(packageRoot, entry.default));
        if (
          !inside(packageRoot, entryFile) ||
          !(await stat(entryFile)).isFile()
        ) {
          fail(
            "INVALID_WORKFLOW_PACKAGE",
            `Workflow entry escapes package or is not a file: ${name}`,
          );
        }
        sources.push({
          packageName: name,
          packageVersion: manifest.version,
          protocolVersion: manifest.intloom.version,
          packageRoot,
          entryUrl: pathToFileURL(entryFile).href,
          assetRoot: dirname(entryFile),
        });
        seen.add(metadataFile);
      } catch (cause) {
        failures.push({
          packageName: name,
          isAvailable: false,
          phase: "discover",
          error: workflowError(
            cause,
            "INVALID_WORKFLOW_PACKAGE",
            `Cannot discover dependency: ${name}`,
          ),
        });
      }
    }
    return { sources, failures };
  } catch (cause) {
    if (LoomError.is(cause)) throw cause;
    fail(
      "INVALID_WORKFLOW_PACKAGE",
      `Cannot discover Workflows from ${projectFile}`,
      cause,
    );
  }
}
