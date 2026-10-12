import { validateAgentResources } from "./validate-agent-resources.ts";
import { realpath, stat } from "node:fs/promises";
import { createRequire, findPackageJSON, registerHooks } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getLogger, LoomError, withLogger } from "@intloom/utils";
import { fail } from "./errors.ts";
import { workflowProtocolVersion } from "./schemas/package-metadata.ts";
import type { LoadedWorkflow, WorkflowPackage } from "./types.ts";
import type { ExecutableCode } from "../effector/execution.ts";
import type { AgentTool } from "@intloom/workflow-sdk";
import { validateWorkflow } from "./validate-workflow.ts";

const loadedPaths = new Map<string, readonly string[]>();
async function importWorkflow(
  source: WorkflowPackage,
): Promise<{ module: unknown; files: readonly string[] }> {
  const known = loadedPaths.get(source.entryUrl);
  if (known) return { module: await import(source.entryUrl), files: known };
  const urls = new Set([source.entryUrl]);
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (
        context.parentURL &&
        urls.has(context.parentURL) &&
        resolved.url.startsWith("file:")
      )
        urls.add(resolved.url);
      return resolved;
    },
  });
  try {
    const module: unknown = await import(source.entryUrl);
    const files = [...urls].map((url) => fileURLToPath(url)).sort();
    loadedPaths.set(source.entryUrl, files);
    return { module, files };
  } finally {
    hook.deregister();
  }
}

function inside(root: string, file: string): boolean {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

/** A project-installed Workflow can load a separate Utils context from its own node_modules. */
async function bindWorkflowLogger(
  workflow: LoadedWorkflow,
): Promise<LoadedWorkflow> {
  let utilsManifest: string | undefined;
  try {
    utilsManifest = findPackageJSON("@intloom/utils", workflow.source.entryUrl);
  } catch (cause) {
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ERR_MODULE_NOT_FOUND"
    )
      return workflow;
    throw cause;
  }
  if (!utilsManifest) return workflow;
  const utilsEntry = createRequire(workflow.source.entryUrl).resolve(
    "@intloom/utils",
  );
  const copy: unknown = await import(pathToFileURL(utilsEntry).href);
  const workflowWithLogger = (copy as { withLogger?: typeof withLogger })
    .withLogger;
  if (typeof workflowWithLogger !== "function")
    throw new Error("Workflow Utils logger context is unavailable.");
  if (workflowWithLogger === withLogger) return workflow;
  const codes: LoadedWorkflow["codes"] = Object.fromEntries(
    Object.entries(workflow.codes).map(([id, code]) => {
      const wrapped: ExecutableCode = function (this: unknown, input, access) {
        return workflowWithLogger(getLogger(), () =>
          code.call(this, input, access),
        );
      };
      if (code.recover) {
        const recover = code.recover;
        wrapped.recover = function (this: unknown, recovery, access) {
          return workflowWithLogger(getLogger(), () =>
            recover.call(this, recovery, access),
          );
        };
      }
      return [id, wrapped];
    }),
  );
  const agentSpecs: LoadedWorkflow["agentSpecs"] = Object.fromEntries(
    Object.entries(workflow.agentSpecs).map(([id, agent]) => [
      id,
      {
        ...agent,
        tools: agent.tools.map((tool) => {
          const execute = tool.execute;
          const wrapped: AgentTool = {
            ...tool,
            id: tool.id,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            execute: function (this: unknown, input, access) {
              // Ordinary method calls keep the original Tool receiver; explicit call/apply receivers pass through.
              const receiver = this === wrapped ? tool : this;
              return workflowWithLogger(getLogger(), () =>
                execute.call(receiver, input, access),
              );
            },
          };
          return wrapped;
        }),
      },
    ]),
  );
  return { ...workflow, codes, agentSpecs };
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
    const imported = await importWorkflow(source);
    const workflow = validateWorkflow(
      { ...source, protectedFiles: imported.files },
      imported.module,
    );
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
    return await bindWorkflowLogger(workflow);
  } catch (cause) {
    if (LoomError.is(cause)) throw cause;
    fail(
      "WORKFLOW_LOAD_FAILED",
      `Cannot load Workflow: ${source.packageName} (${source.entryUrl})`,
      cause,
    );
  }
}
