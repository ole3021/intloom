import { validateAgentResources } from "./validate-agent-resources.ts";
import { realpath, stat } from "node:fs/promises";
import { createRequire, findPackageJSON, registerHooks } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getLogger, LoomError, withLogger } from "@intloom/utils";
import { fail } from "./errors.ts";
import { loomProtocolVersion } from "./schemas/package-metadata.ts";
import type { LoadedLoom, LoomPackage } from "./types.ts";
import type { ExecutableCode } from "@intloom/loom-sdk";
import type { AgentTool } from "@intloom/loom-sdk";
import { validateLoom } from "./validate-loom.ts";

const loadedPaths = new Map<string, readonly string[]>();
async function importLoom(
  source: LoomPackage,
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

/** A project-installed Loom can load a separate Utils context from its own node_modules. */
async function bindLoomLogger(loom: LoadedLoom): Promise<LoadedLoom> {
  let utilsManifest: string | undefined;
  try {
    utilsManifest = findPackageJSON("@intloom/utils", loom.source.entryUrl);
  } catch (cause) {
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ERR_MODULE_NOT_FOUND"
    )
      return loom;
    throw cause;
  }
  if (!utilsManifest) return loom;
  const utilsEntry = createRequire(loom.source.entryUrl).resolve(
    "@intloom/utils",
  );
  const copy: unknown = await import(pathToFileURL(utilsEntry).href);
  const loomWithLogger = (copy as { withLogger?: typeof withLogger })
    .withLogger;
  if (typeof loomWithLogger !== "function")
    throw new Error("Loom Utils logger context is unavailable.");
  if (loomWithLogger === withLogger) return loom;
  const codes: LoadedLoom["codes"] = Object.fromEntries(
    Object.entries(loom.codes).map(([id, code]) => {
      const wrapped: ExecutableCode = function (this: unknown, access) {
        return loomWithLogger(getLogger(), () => code.call(this, access));
      };
      if (code.recover) {
        const recover = code.recover;
        wrapped.recover = function (this: unknown, recovery, access) {
          return loomWithLogger(getLogger(), () =>
            recover.call(this, recovery, access),
          );
        };
      }
      return [id, wrapped];
    }),
  );
  const agentSpecs: LoadedLoom["agentSpecs"] = Object.fromEntries(
    Object.entries(loom.agentSpecs).map(([id, agent]) => [
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
              return loomWithLogger(getLogger(), () =>
                execute.call(receiver, input, access),
              );
            },
          };
          return wrapped;
        }),
      },
    ]),
  );
  return { ...loom, codes, agentSpecs };
}

export async function loadLoom(source: LoomPackage): Promise<LoadedLoom> {
  try {
    if (source.protocolVersion !== loomProtocolVersion)
      fail(
        "UNSUPPORTED_LOOM_PROTOCOL",
        `Unsupported Loom protocol: ${source.protocolVersion}`,
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
        "INVALID_LOOM_PACKAGE",
        `Invalid Loom entry or resource root: ${source.packageName}`,
      );
    }
    // Import evaluates top-level definitions; validation does not invoke Code, Tools, or models.
    const imported = await importLoom(source);
    const loom = validateLoom(
      { ...source, protectedFiles: imported.files },
      imported.module,
    );
    for (const agent of Object.values(loom.agentSpecs)) {
      for (const skill of agent.skills) {
        for (const asset of skill.assets) {
          if (
            asset.includes("\\") ||
            asset.split("/").some((part) => part === ".." || part === "") ||
            isAbsolute(asset)
          ) {
            fail("INVALID_LOOM", `Invalid Skill asset path: ${asset}`);
          }
          const file = await realpath(resolve(assets, asset));
          if (!inside(assets, file) || !(await stat(file)).isFile()) {
            fail(
              "INVALID_LOOM",
              `Skill asset escapes resource root or is not a file: ${asset}`,
            );
          }
        }
      }
    }
    await validateAgentResources(loom);
    return await bindLoomLogger(loom);
  } catch (cause) {
    if (LoomError.is(cause)) throw cause;
    fail(
      "LOOM_LOAD_FAILED",
      `Cannot load Loom: ${source.packageName} (${source.entryUrl})`,
      cause,
    );
  }
}
