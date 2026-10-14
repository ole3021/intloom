import { cp, lstat, mkdir, readFile, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseDocument } from "yaml";
import * as z from "zod";
import {
  E2eError,
  limitsSchema,
  modelSchema,
  type CaseManifest,
  type Entry,
  type ModelConfig,
} from "./contracts.ts";
import { resolveProfile } from "./profile.ts";

const model = z.union([
  z.string().min(1),
  modelSchema.omit({ secret: true, baseURL: true }).partial({ provider: true }),
]);
const modelsSchema = z.strictObject({
  user: model,
  cmd: z.record(z.string(), model).optional(),
  mcp: z.strictObject({ worker: model }).optional(),
});
export const configurationSchema = z.strictObject({
  workflow: z.strictObject({
    source: z.string().min(1),
    flowName: z.string().min(1),
  }),
  models: modelsSchema,
  zen: z.strictObject({ baseURL: z.url() }).optional(),
  storage: z.enum(["file", "sqlite"]).default("file"),
  limits: limitsSchema.default({}),
  preparation: z
    .strictObject({ scripts: z.array(z.string().min(1)).default([]) })
    .optional(),
  acceptance: z
    .strictObject({
      instructions: z.string().min(1).optional(),
      scripts: z.array(z.string().min(1)).default([]),
    })
    .optional(),
});
export type Configuration = z.infer<typeof configurationSchema>;

export function caseConfiguration(
  config: Configuration,
  manifest: CaseManifest,
): Configuration {
  if (!manifest.models) return config;
  const overrides = manifest.models;
  return configurationSchema.parse({
    ...config,
    models: {
      ...config.models,
      ...overrides,
      ...(overrides.cmd
        ? { cmd: { ...config.models.cmd, ...(overrides.cmd as object) } }
        : {}),
      ...(overrides.mcp
        ? { mcp: { ...config.models.mcp, ...(overrides.mcp as object) } }
        : {}),
    },
  });
}
export function configurationProfile(
  config: Configuration,
  entry: Entry,
  environment: NodeJS.ProcessEnv,
) {
  const expand = (value: z.infer<typeof model>): ModelConfig => ({
    ...(typeof value === "string" ? { model: value } : value),
    provider:
      typeof value === "string"
        ? "openai-compatible"
        : (value.provider ?? "openai-compatible"),
    secret: "ENV.ZEN_API_KEY",
    baseURL: config.zen?.baseURL ?? "https://opencode.ai/inference/v1",
  });
  const worker = config.models.mcp?.worker;
  if (entry === "mcp" && !worker)
    throw new E2eError(
      "WORKER_MODEL_MISSING",
      "Configure models.mcp.worker for the MCP entry.",
      "environment",
      "blocked",
    );
  return resolveProfile(
    {
      user: expand(config.models.user),
      ...(entry === "mcp" && worker ? { clientAgent: expand(worker) } : {}),
      ...(entry === "cmd" && config.models.cmd
        ? {
            service: Object.fromEntries(
              Object.entries(config.models.cmd).map(([role, value]) => [
                role,
                expand(value),
              ]),
            ),
          }
        : {}),
      storage: config.storage,
      limits: config.limits,
    },
    entry,
    environment,
  );
}
export async function readConfiguration(suite: string) {
  const document = parseDocument(
    await readFile(join(suite, "config.yaml"), "utf8"),
    { uniqueKeys: true },
  );
  if (document.errors.length)
    throw new E2eError(
      "CONFIGURATION_INVALID",
      "Workflow E2E config.yaml is invalid YAML.",
      "scenario",
      "blocked",
    );
  return configurationSchema.parse(document.toJS());
}
export function suiteFile(suite: string, path: string) {
  const target = resolve(suite, path);
  const local = relative(suite, target);
  if (!local || local.startsWith("..") || resolve(path) === path)
    throw new E2eError(
      "CONFIGURATION_INVALID",
      "Resource paths must be relative files inside the Workflow E2E directory.",
      "scenario",
      "blocked",
    );
  return target;
}
/** Preserve configuration and selected script resources, not the entire case library. */
export async function snapshotConfiguration(
  suite: string,
  target: string,
  config: Configuration,
) {
  const files = [
    "config.yaml",
    ...(config.preparation?.scripts ?? []),
    ...(config.acceptance?.instructions
      ? [config.acceptance.instructions]
      : []),
    ...(config.acceptance?.scripts ?? []),
  ];
  for (const path of files) {
    const source = suiteFile(suite, path);
    const destination = join(target, path);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    if (path.includes("/"))
      await cp(dirname(source), dirname(destination), {
        recursive: true,
        filter: (name) =>
          !name.endsWith(".spec.ts") && !name.includes("node_modules"),
      });
    else await cp(source, destination, { errorOnExist: true, force: false });
  }
  if (config.acceptance?.scripts.length || config.preparation?.scripts.length) {
    let owner = suite;
    while (dirname(owner) !== owner) {
      const modules = join(owner, "node_modules");
      if ((await lstat(modules).catch(() => undefined))?.isDirectory()) {
        await symlink(modules, join(target, "node_modules"));
        break;
      }
      owner = dirname(owner);
    }
  }
  return config.acceptance?.instructions
    ? await readFile(join(target, config.acceptance.instructions), "utf8")
    : "";
}
