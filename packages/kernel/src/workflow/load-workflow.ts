import { validateAgentResources } from "./validate-agent-resources.ts";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LoomError } from "@intloom/utils";
import { fail } from "./errors.ts";
import { workflowProtocolVersion } from "./schemas/package-metadata.ts";
import type { LoadedWorkflow, WorkflowPackage } from "./types.ts";
import { validateWorkflow } from "./validate-workflow.ts";

function inside(root: string, file: string): boolean {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

export async function loadWorkflow(
  source: WorkflowPackage,
): Promise<LoadedWorkflow> {
  try {
    if (source.protocolVersion !== workflowProtocolVersion)
      fail(
        "UNSUPPORTED_WORKFLOW_PROTOCOL",
        `Unsupported Workflow protocol: ${source.protocolVersion}`,
      );
    const entry = await realpath(fileURLToPath(source.entryUrl));
    const root = await realpath(source.packageRoot);
    const assets = await realpath(source.assetRoot);
    if (
      !inside(root, entry) ||
      assets !== dirname(entry) ||
      !(await stat(entry)).isFile()
    ) {
      fail(
        "INVALID_WORKFLOW_PACKAGE",
        `Invalid Workflow entry or resource root: ${source.packageName}`,
      );
    }
    // Import evaluates top-level definitions; validation does not invoke Code, Tools, or models.
    const module: unknown = await import(source.entryUrl);
    const workflow = validateWorkflow(source, module);
    for (const agent of Object.values(workflow.agentSpecs)) {
      for (const skill of agent.skills) {
        for (const asset of skill.assets) {
          if (
            asset.includes("\\") ||
            asset.split("/").some((part) => part === ".." || part === "") ||
            isAbsolute(asset)
          ) {
            fail("INVALID_WORKFLOW", `Invalid Skill asset path: ${asset}`);
          }
          const file = await realpath(resolve(assets, asset));
          if (!inside(assets, file) || !(await stat(file)).isFile()) {
            fail(
              "INVALID_WORKFLOW",
              `Skill asset escapes resource root or is not a file: ${asset}`,
            );
          }
        }
      }
    }
    await validateAgentResources(workflow);
    return workflow;
  } catch (cause) {
    if (LoomError.is(cause)) throw cause;
    fail(
      "WORKFLOW_LOAD_FAILED",
      `Cannot load Workflow: ${source.packageName} (${source.entryUrl})`,
      cause,
    );
  }
}
