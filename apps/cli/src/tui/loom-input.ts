import type { LoomInput, LoomInputKind } from "@intloom/kernel";
import { runRequestSchema } from "@intloom/kernel/service";

/** The description-only case stays plain text; other fixed slots use an explicit JSON form. */
export function parseLoomDraft(
  kinds: readonly LoomInputKind[],
  text: string,
): LoomInput {
  const value =
    kinds.length === 1 && kinds[0] === "prompt"
      ? { prompt: text }
      : JSON.parse(text || "{}");
  const input = runRequestSchema.shape.input.parse(value);
  if (
    kinds.some((kind) => input[kind] === undefined) ||
    Object.keys(input).some((kind) => !kinds.includes(kind as LoomInputKind))
  )
    throw new Error(
      `Provide exactly these Loom inputs: ${kinds.join(", ") || "none"}.`,
    );
  return input;
}

export function loomInputHint(kinds: readonly LoomInputKind[]): string {
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
