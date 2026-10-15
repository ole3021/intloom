import * as z from "zod";
import { text, refs } from "../../../src/schema/common.ts";
export const designObjectSchema = z.strictObject({
  id: text,
  kind: z.enum(["module", "interface", "data", "scenario", "decision", "risk"]),
  name: text,
  description: text,
  status: z.enum(["active", "retired"]),
  requirementRefs: refs,
  relatedRefs: refs,
});
export const designConstraintSchema = z.strictObject({
  id: text,
  description: text,
  status: z.enum(["active", "retired"]),
  designRefs: refs,
});
export const solutionArtifactSchema = z.strictObject({
  objects: z.array(designObjectSchema),
  constraints: z.array(designConstraintSchema),
});
export type SolutionArtifact = z.infer<typeof solutionArtifactSchema>;
export default solutionArtifactSchema;
