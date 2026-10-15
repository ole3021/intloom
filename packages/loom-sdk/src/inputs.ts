import * as z from "zod";
import type { ReadonlyValue } from "./json.ts";

/** Fixed input slots understood by every IntLoom client. */
export const loomInputKindSchema = z.enum(["prompt", "files", "dirs", "urls"]);
export type LoomInputKind = z.infer<typeof loomInputKindSchema>;

/** Every declared slot is required. An empty declaration describes an input-free Loom. */
export const loomInputsSchema = z
  .array(loomInputKindSchema)
  .refine(
    (inputs) => new Set(inputs).size === inputs.length,
    "Loom input slots must be unique",
  );

const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Input must not be blank");
export const loomInputSchema = z.strictObject({
  prompt: text.optional(),
  files: z.array(text).min(1).optional(),
  dirs: z.array(text).min(1).optional(),
  urls: z.array(z.url()).min(1).optional(),
});

/** Paths and URLs are references; passing them does not read files, fetch URLs, or grant capabilities. */
export type LoomInput = ReadonlyValue<z.infer<typeof loomInputSchema>>;

/** Validate and detach input before admitting a Run or handing it to Loom code. */
export function parseLoomInput(
  inputs: readonly LoomInputKind[],
  value: unknown,
): LoomInput {
  const declared = loomInputsSchema.parse(inputs);
  const parsed = loomInputSchema.parse(value);
  for (const kind of loomInputKindSchema.options) {
    if (declared.includes(kind) !== (parsed[kind] !== undefined)) {
      throw new Error(
        declared.includes(kind)
          ? `Loom input ${kind} is required.`
          : `Loom does not accept input ${kind}.`,
      );
    }
  }
  return {
    ...(parsed.prompt === undefined ? {} : { prompt: parsed.prompt }),
    ...(parsed.files === undefined ? {} : { files: parsed.files }),
    ...(parsed.dirs === undefined ? {} : { dirs: parsed.dirs }),
    ...(parsed.urls === undefined ? {} : { urls: parsed.urls }),
  };
}
