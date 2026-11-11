import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { parse } from "yaml";
import { z } from "zod";
import {
  IntloomError,
  type RuntimeBindings,
  type ModelBindingDescription,
} from "@intloom/loom-sdk";
import { modelSchema } from "./bindings.ts";

const configSchema = z.strictObject({
  version: z.literal(1),
  harness: z.enum(["mastra", "opencode"]).optional(),
  service: z
    .strictObject({ port: z.number().int().min(1).max(65535).optional() })
    .optional(),
  models: z
    .record(
      z.string(),
      modelSchema.extend({
        credentialRef: z.string().regex(/^env:[A-Za-z_][A-Za-z0-9_]*$/),
      }),
    )
    .optional(),
  profiles: z.record(z.string(), z.string().min(1)).optional(),
  bindings: z
    .record(z.string(), z.record(z.string(), z.string().min(1)))
    .optional(),
});
async function optionalFile(path: string) {
  return readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
}

async function readConfig(directory: string) {
  const path = join(directory, "intloom.yaml");
  const content = await optionalFile(path);
  if (content === undefined) return undefined;
  try {
    return configSchema.parse(parse(content));
  } catch {
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      `Invalid model configuration in ${path}`,
    );
  }
}

export async function loadConfiguration(
  projectDir: string,
  injected: Pick<RuntimeBindings, "tools" | "resolveCredential">,
  globalDir = join(homedir(), ".intloom"),
): Promise<RuntimeBindings> {
  const models: Record<string, ModelBindingDescription> = Object.create(null);
  const profiles: Record<string, string> = Object.create(null);
  const routes: Record<string, Record<string, string>> = Object.create(null);
  for (const directory of new Set([globalDir, projectDir])) {
    const config = await readConfig(directory);
    if (!config) continue;
    Object.assign(models, config.models);
    Object.assign(profiles, config.profiles);
    for (const [scope, slots] of Object.entries(config.bindings ?? {})) {
      routes[scope] = { ...routes[scope], ...slots };
    }
  }
  function model(alias: string) {
    if (!models[alias])
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        `Unknown configured model: ${alias}`,
      );
    return models[alias];
  }
  const aliases = Object.fromEntries(
    Object.entries(profiles).map(([k, v]) => [k, model(v)]),
  );
  const bindings = Object.fromEntries(
    Object.entries(routes).map(([scope, slots]) => [
      scope,
      Object.fromEntries(
        Object.entries(slots).map(([slot, v]) => [slot, model(v)]),
      ),
    ]),
  );
  return {
    ...injected,
    models: bindings,
    profiles: aliases,
    resolveCredential:
      injected.resolveCredential ??
      (async (ref) => {
        if (!ref.startsWith("env:")) return "";
        const key = ref.slice(4);
        if (process.env[key] !== undefined) return process.env[key];
        for (const directory of new Set([projectDir, globalDir])) {
          const raw = await optionalFile(join(directory, ".env"));
          if (raw !== undefined) {
            const value = parseEnv(raw)[key];
            if (value !== undefined) return value;
          }
        }
        return "";
      }),
  };
}

export async function readServicePort(globalDir: string) {
  const path = join(globalDir, "intloom.yaml");
  try {
    return (await readConfig(globalDir))?.service?.port ?? 7341;
  } catch {
    throw new IntloomError(
      "CONFIG_INVALID",
      `Cannot load ${path}. Check file permissions and YAML syntax; use version: 1 and an integer service.port between 1 and 65535. Fix the file, then run intloom startup again.`,
      { path },
    );
  }
}

export async function configuredHarness(
  globalDir: string,
  projectDir?: string,
) {
  for (const path of new Set([projectDir, globalDir])) {
    if (!path) continue;
    const selected = (await readConfig(path))?.harness;
    if (selected) return selected;
  }
  return "mastra" as const;
}

// Host-facing projection. The credential resolver and provider options stay in the service.
export async function describeConfiguration(
  globalDir: string,
  projectDir?: string,
) {
  const [bindings, harness] = await Promise.all([
    loadConfiguration(projectDir ?? globalDir, {}, globalDir),
    configuredHarness(globalDir, projectDir),
  ]);
  const describe = (name: string, b: ModelBindingDescription) => ({
    name,
    provider: b.provider,
    model: b.model,
    credentialRef: b.credentialRef,
  });
  return {
    harness,
    profiles: Object.entries(bindings.profiles ?? {}).map(([key, v]) =>
      describe(key, v),
    ),
    slots: Object.entries(bindings.models ?? {}).flatMap(([scope, slots]) =>
      Object.entries(slots).map(([slot, v]) =>
        describe(scope + " / " + slot, v),
      ),
    ),
  };
}
