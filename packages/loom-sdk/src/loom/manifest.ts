import { z } from "zod";
import { inputDeclarationSchema } from "./input.ts";
import { outputsSchema, relativePathSchema } from "./output.ts";

export const execReferenceSchema = z.string().refine((reference) => {
  const [path, name, extra] = reference.split("#");
  return (
    path !== undefined &&
    relativePathSchema.safeParse(path).success &&
    /\.(?:ts|mts|js|mjs)$/.test(path) &&
    extra === undefined &&
    (name === undefined || /^[A-Za-z_$][\w$]*$/.test(name))
  );
}, "Expected a local .ts, .mts, .js or .mjs module, optionally followed by #exportName");

export const loomManifestSchema = z.strictObject({
  schemaVersion: z.literal("0.5"),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  entry: execReferenceSchema,
  agent: execReferenceSchema.optional(),
  execution: z.strictObject({ scope: z.enum(["intloom", "workspace"]) }),
  input: inputDeclarationSchema.default({}),
  output: outputsSchema.default({}),
  resources: z.array(relativePathSchema).default([]),
});

export type LoomManifest = z.infer<typeof loomManifestSchema>;
export type LoomManifestSource = z.input<typeof loomManifestSchema>;
