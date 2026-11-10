import {
  IntloomError,
  type RuntimeBindings,
  type RuntimeToolBinding,
  type LoomManifest,
  type RunBindings,
} from "@intloom/loom-sdk";
import { copyJson } from "@intloom/loom-sdk/json";
import { checkModelBinding } from "../mastra/index.ts";
import { z } from "zod";

const text = z.string().min(1);
export const modelSchema = z.strictObject({
  provider: z.enum(["openai", "minimax-cn", "alibaba"]),
  model: text,
  credentialRef: text,
  options: z
    .strictObject({
      baseUrl: z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        }, "Use an HTTP(S) base URL without credentials or query parameters.")
        .optional(),
      api: z.enum(["chat", "responses"]).optional(),
    })
    .optional(),
});
export const bindingsSchema = z.strictObject({
  profiles: z.record(text, modelSchema).optional(),
  models: z.record(text, z.record(text, modelSchema)).optional(),
  tools: z
    .record(
      text,
      z.record(
        text,
        z.strictObject({
          implementation: text,
          revision: text,
          config: z.record(z.string(), z.unknown()).optional(),
          credentialRef: text.optional(),
          execute: z.custom<RuntimeToolBinding["execute"]>(
            (value) => typeof value === "function",
          ),
        }),
      ),
    )
    .optional(),
  resolveCredential: z
    .custom<NonNullable<RuntimeBindings["resolveCredential"]>>(
      (value) => typeof value === "function",
    )
    .optional(),
});
export function selectBindings(
  manifest: LoomManifest,
  host: RuntimeBindings,
  savedModels?: RunBindings["models"],
  strengths?: Readonly<Record<string, string>>,
): {
  descriptions: RunBindings;
  tools: Readonly<Record<string, RuntimeToolBinding>>;
} {
  const scope = `${manifest.id}@${manifest.version}`;
  const models: Record<
    string,
    NonNullable<RuntimeBindings["models"]>[string][string]
  > = {};
  const tools: Record<string, RuntimeToolBinding> = {};
  for (const [slot, capabilities] of Object.entries(
    manifest.requirements.models,
  )) {
    const profile =
      strengths?.[slot] ??
      Object.values(manifest.components).find(
        (c) => c.model?.slot === slot && c.model.profile,
      )?.model?.profile;
    if (!savedModels && !host.profiles?.default)
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        "Agent execution requires profiles.default in intloom.yaml.",
        { scope, slot },
      );
    const explicit = host.models?.[scope]?.[slot];
    const model = savedModels
      ? savedModels[slot]
      : (explicit ??
        (profile ? host.profiles?.[profile] : undefined) ??
        host.profiles?.default);
    if (!model)
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        "A required model slot is not bound.",
        { scope, slot },
      );
    checkModelBinding(model, capabilities);
    models[slot] = model;
  }
  for (const slot of manifest.requirements.tools) {
    const tool = host.tools?.[scope]?.[slot] ?? host.tools?.["*"]?.[slot];
    if (!tool)
      throw new IntloomError(
        "BINDING_UNAVAILABLE",
        "A required tool slot is not bound.",
        { scope, slot },
      );
    tools[slot] = tool;
  }
  const descriptions = {
    models,
    tools: Object.fromEntries(
      Object.entries(tools).map(
        ([slot, { execute: _execute, ...description }]) => [slot, description],
      ),
    ),
  };
  return {
    descriptions: copyJson(descriptions, "bindings") as unknown as RunBindings,
    tools,
  };
}
export async function resolveCredential(
  host: RuntimeBindings,
  reference: string,
): Promise<string> {
  const value = host.resolveCredential
    ? await host.resolveCredential(reference)
    : reference.startsWith("env:")
      ? process.env[reference.slice(4)]
      : undefined;
  if (!value)
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      "The configured credential reference is unavailable.",
    );
  return value;
}
