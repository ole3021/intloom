import {
  E2eError,
  profileSchema,
  type Entry,
  type ModelConfig,
  type Profile,
  type ProjectProfile,
} from "./contracts.ts";

function resolveValue(value: string, environment: NodeJS.ProcessEnv) {
  if (!value.startsWith("ENV.")) return value;
  const actual = environment[value.slice(4)];
  if (!actual?.trim())
    throw new E2eError(
      "PROFILE_ENV_MISSING",
      `The required model configuration variable ${value.slice(4)} is missing.`,
      "environment",
      "blocked",
    );
  return actual;
}
export function resolveProfile(
  input: unknown,
  entry: Entry,
  environment: NodeJS.ProcessEnv = process.env,
): Profile {
  const profile = profileSchema.parse(input);
  function model(config: ModelConfig): ModelConfig {
    const secret = environment[config.secret.slice(4)];
    if (!secret?.trim() || secret.startsWith("encrypted:"))
      throw new E2eError(
        "MODEL_CREDENTIAL_MISSING",
        `The required model credential ${config.secret} is missing or encrypted.`,
        "environment",
        "blocked",
      );
    const resolved = {
      ...config,
      model: resolveValue(config.model, environment),
      ...(config.baseURL
        ? { baseURL: resolveValue(config.baseURL, environment) }
        : {}),
    };
    if (resolved.baseURL) {
      const url = new URL(resolved.baseURL);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash
      )
        throw new E2eError(
          "PROFILE_INVALID",
          "Model endpoints must be HTTP(S) URLs without credentials or fragments.",
          "environment",
          "blocked",
        );
    }
    return resolved;
  }
  profile.user = model(profile.user);
  if (entry === "mcp" && profile.mcpExecutor === "mcp_client")
    profile.clientAgent = model(profile.clientAgent ?? profile.user);
  if (entry === "cmd" || profile.mcpExecutor === "service") {
    if (!profile.service?.default)
      throw new E2eError(
        "PROFILE_INVALID",
        "Service execution requires a default service model.",
        "environment",
        "blocked",
      );
    for (const role of Object.keys(profile.service)) {
      const configured = profile.service[role];
      if (configured) profile.service[role] = model(configured);
    }
  } else delete profile.service;
  return profile;
}
export function modelSecrets(
  profile: Profile,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return [
    ...new Set(
      [
        profile.user,
        profile.clientAgent,
        ...Object.values(profile.service ?? {}),
      ]
        .filter((model): model is ModelConfig => model !== undefined)
        .map((model) => environment[model.secret.slice(4)])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}
export function executionLimits(profile: ProjectProfile) {
  return {
    ...profile.limits,
    commandTimeoutMs: profile.limits.commandTimeoutMs ?? 30000,
    modelConnectionTimeoutMs: profile.limits.modelConnectionTimeoutMs ?? 60000,
    modelConnectionRetries: profile.limits.modelConnectionRetries ?? 0,
  };
}
