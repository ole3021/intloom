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
      requestTimeoutMs: z
        .number()
        .int()
        .positive()
        .max(2_147_483_647)
        .optional(),
      totalTimeoutMs: z.number().int().positive().max(2_147_483_647).optional(),
      api: z.enum(["chat", "responses"]).optional(),
      reasoningEffort: z.literal("none").optional(),
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
  harness?: "mastra" | "opencode",
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
    checkModelBinding(model, capabilities, harness);
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
  let value: string | undefined;
  try {
    value = host.resolveCredential
      ? await host.resolveCredential(reference)
      : reference.startsWith("env:")
        ? process.env[reference.slice(4)]
        : undefined;
  } catch {
    // A custom resolver's exception may contain the credential.
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      "The configured credential could not be read.",
    );
  }
  if (!value?.trim()) {
    const name = /^env:([A-Za-z_][A-Za-z0-9_]*)$/.exec(reference)?.[1];
    throw new IntloomError(
      "BINDING_UNAVAILABLE",
      name
        ? `Missing credential ${name}. Set it in the service environment or its .env file.`
        : "The configured credential reference is unavailable.",
    );
  }
  return value;
}
