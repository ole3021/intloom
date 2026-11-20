import { z } from "zod";
import { skillMetadataSchema } from "../skills.ts";
import { loomManifestSchema } from "./manifest.ts";
import { relativePathSchema } from "./output.ts";
import { packageIdentitySchema } from "./package.ts";

export const compiledReferenceSchema = z.strictObject({
  module: relativePathSchema,
  export: z.string().min(1),
  kind: z.enum(["code", "agent", "workflow"]),
});

export const compiledLoomSchema = loomManifestSchema
  .omit({ entry: true, agent: true })
  .extend({
    package: packageIdentitySchema,
    entry: compiledReferenceSchema,
    agent: compiledReferenceSchema
      .extend({ kind: z.literal("agent") })
      .optional(),
    skills: z.array(
      z.strictObject({
        path: relativePathSchema,
        metadata: skillMetadataSchema,
      }),
    ),
  });

export type CompiledReference = z.infer<typeof compiledReferenceSchema>;
export type CompiledLoom = z.infer<typeof compiledLoomSchema>;
