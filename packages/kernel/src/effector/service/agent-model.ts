import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import type { AgentConfig } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";
import * as z from "zod";
import type { LoomConfig } from "../../core/schemas/loom-config.ts";
import { fail } from "../../loom/errors.ts";
import { agentModelTypeSchema } from "@intloom/loom-sdk";
import { packageVersion } from "../../shared/version.ts";
import {
  createCredentialResolver,
  type CredentialResolver,
} from "./credentials.ts";

const providerOptionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.json()),
);

export function resolveModelConfig(
  roleName: string,
  configuration: LoomConfig,
  label: string,
  credentials: CredentialResolver = createCredentialResolver(),
) {
  const role = agentModelTypeSchema.safeParse(roleName);
  if (!role.success)
    fail("LOOM_AGENT_FAILED", `${label}: Unknown model role: ${roleName}`);
  // The caller validates project configuration; default is used only when a valid role lacks dedicated configuration.
  if (!configuration.llms)
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Service execution requires llms.default in intloom.yaml.",
    });
  const config = configuration.llms[role.data] ?? configuration.llms.default;
  const apiKey = credentials(config.secret);
  if (!apiKey?.trim() || apiKey.startsWith("encrypted:")) {
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: `${label}: Missing decrypted credential: ${config.secret}. ${config.secret.startsWith("ENV.") ? "Set it in process.env or the project's .env" : "Export its decrypted value"} and restart the service.`,
    });
  }

  return { config, apiKey };
}

export function createModelOptions(
  config: NonNullable<LoomConfig["llms"]>["default"],
  apiKey: string,
  label: string,
): Pick<AgentConfig, "model" | "defaultOptions"> {
  // Custom Anthropic endpoints use the native SDK to preserve the Anthropic protocol.
  const model =
    config.provider === "anthropic"
      ? createAnthropic({
          apiKey,
          headers: { "User-Agent": `intloom/${packageVersion}` },
          ...(config.baseURL ? { baseURL: config.baseURL } : {}),
        })(config.model)
      : {
          providerId: "openai",
          modelId: config.model,
          apiKey,
          headers: { "User-Agent": `intloom/${packageVersion}` },
          ...(config.baseURL ? { url: config.baseURL } : {}),
        };
  const providerOptions =
    config.providerOptions === undefined
      ? undefined
      : providerOptionsSchema.safeParse(config.providerOptions);
  if (providerOptions && !providerOptions.success) {
    fail("LOOM_AGENT_FAILED", `${label}: Invalid provider options`);
  }
  return {
    model,
    defaultOptions: {
      modelSettings: {
        ...(config.parameters?.temperature === undefined
          ? {}
          : { temperature: config.parameters.temperature }),
        ...(config.parameters?.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: config.parameters.maxOutputTokens }),
        ...(config.parameters?.topP === undefined
          ? {}
          : { topP: config.parameters.topP }),
      },
      ...(providerOptions?.success
        ? { providerOptions: providerOptions.data }
        : {}),
    },
  };
}
