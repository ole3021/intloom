import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "yaml";
import {
  configurationSchema,
  modelsSchema,
  E2eError,
  type Configuration,
  type Models,
  type ModelConfig,
} from "./contracts.ts";

export async function readYaml(file: string): Promise<unknown> {
  const document = parseDocument(await readFile(file, "utf8"), {
    uniqueKeys: true,
  });
  if (document.errors.length)
    throw new E2eError(
      "CONFIGURATION_INVALID",
      `Invalid YAML: ${file}`,
      "scenario",
      "blocked",
    );
  return document.toJS();
}
export async function readConfiguration(suite: string): Promise<Configuration> {
  return configurationSchema.parse(await readYaml(join(suite, "config.yaml")));
}
export async function resolveModels(
  config: Configuration,
  profile: string | undefined,
  env: NodeJS.ProcessEnv,
): Promise<Models> {
  const models = modelsSchema.parse(
    profile ? await readYaml(profile) : config.models,
  );
  function value(text: string) {
    if (!text.startsWith("ENV.")) return text;
    const found = env[text.slice(4)];
    if (!found?.trim())
      throw new E2eError(
        "MODEL_CONFIGURATION_MISSING",
        `Provide ${text} in the environment.`,
        "environment",
        "blocked",
      );
    return found;
  }
  function model(input: ModelConfig): ModelConfig {
    value(input.secret);
    const resolved = {
      ...input,
      model: value(input.model),
      ...(input.baseURL ? { baseURL: value(input.baseURL) } : {}),
    };
    if (resolved.baseURL) {
      const url = new URL(resolved.baseURL);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash
      )
        throw new E2eError(
          "MODEL_CONFIGURATION_INVALID",
          "Model endpoints must be HTTP(S) URLs without credentials or fragments.",
          "environment",
          "blocked",
        );
    }
    return resolved;
  }
  return {
    user: model(models.user),
    ...(models.worker ? { worker: model(models.worker) } : {}),
    ...(models.service
      ? {
          service: Object.fromEntries(
            Object.entries(models.service).flatMap(([k, v]) =>
              v ? [[k, model(v)]] : [],
            ),
          ) as Models["service"],
        }
      : {}),
  };
}
export function modelSecrets(models: Models, env: NodeJS.ProcessEnv): string[] {
  return [models.user, models.worker, ...Object.values(models.service ?? {})]
    .filter((m): m is ModelConfig => m !== undefined)
    .map((m) => env[m.secret.slice(4)])
    .filter((s): s is string => Boolean(s));
}
