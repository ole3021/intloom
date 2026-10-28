import {
  loomInputSchema,
  parseSchemaValue,
  type JsonSchema,
  type LoomInvocationInput,
  type LoomInputKind,
} from "@intloom/loom-sdk";

/** The description-only case stays plain text; other fixed slots use an explicit JSON form. */
export function parseLoomDraft(
  kinds: readonly LoomInputKind[],
  text: string,
  schema?: JsonSchema,
): LoomInvocationInput {
  if (schema !== undefined) return parseSchemaValue(schema, JSON.parse(text));
  const value =
    kinds.length === 1 && kinds[0] === "prompt"
      ? { prompt: text }
      : JSON.parse(text || "{}");
  const input = loomInputSchema.parse(value);
  if (
    kinds.some((kind) => input[kind] === undefined) ||
    Object.keys(input).some((kind) => !kinds.includes(kind as LoomInputKind))
  )
    throw new Error(
      `Provide exactly these Loom inputs: ${kinds.join(", ") || "none"}.`,
    );
  return input;
}

export function loomInputHint(
  kinds: readonly LoomInputKind[],
  schema?: JsonSchema,
): string {
  if (schema !== undefined)
    return `JSON input schema: ${JSON.stringify(schema)}`;
  if (kinds.length === 1 && kinds[0] === "prompt")
    return "Describe your request, or / for commands";
  const examples = {
    prompt: "Describe your request",
    files: ["src/file.ts"],
    dirs: ["src"],
    urls: ["https://example.com"],
  };
  return `JSON inputs: ${JSON.stringify(Object.fromEntries(kinds.map((kind) => [kind, examples[kind]])))}`;
}
