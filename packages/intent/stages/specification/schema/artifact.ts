import * as z from "zod";
import { text } from "../../../src/schema/common.ts";
const entity = z.strictObject({
  id: text,
  description: text,
  status: z.enum(["active", "retired"]),
});
export const domainSchema = entity.extend({ name: text });
export const featureSchema = entity.extend({
  name: text,
  domainRef: text.optional(),
});
export const requirementSchema = entity.extend({ featureRef: text });
export const acceptanceSchema = entity.extend({ requirementRef: text });
export const constraintSchema = entity;
export const specificationArtifactSchema = z.strictObject({
  domains: z.array(domainSchema),
  features: z.array(featureSchema),
  requirements: z.array(requirementSchema),
  acceptances: z.array(acceptanceSchema),
  constraints: z.array(constraintSchema),
});
export type SpecificationArtifact = z.infer<typeof specificationArtifactSchema>;
export default specificationArtifactSchema;
