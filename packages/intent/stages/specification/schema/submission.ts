import * as z from "zod";
import { text, refs, analysisSchema } from "../../../src/schema/common.ts";
import {
  domainSchema,
  featureSchema,
  requirementSchema,
  acceptanceSchema,
  constraintSchema,
} from "./artifact.ts";
export const workItemSchema = z.strictObject({
  id: text,
  action: z.enum(["add", "adjust", "remove", "fix", "continue"]),
  description: text,
  requirementRefs: refs.min(1),
});
export const scopeSchema = z.strictObject({
  workItems: z.array(workItemSchema).min(1),
  roundCriteria: z.array(z.strictObject({ id: text, description: text })),
  coverage: z.array(
    z.strictObject({
      workItemRef: text,
      acceptanceRefs: refs,
      roundCriteriaRefs: refs,
      constraintRefs: refs,
    }),
  ),
  excluded: z.array(text),
});
export const analyzeInputSchema = z.strictObject({
  revision: z.number(),
  analysis: analysisSchema,
});
export const editInputSchema = z.strictObject({
  revision: z.number(),
  edits: z
    .array(
      z.discriminatedUnion("collection", [
        z.strictObject({
          collection: z.literal("domains"),
          value: domainSchema,
          reason: text,
        }),
        z.strictObject({
          collection: z.literal("features"),
          value: featureSchema,
          reason: text,
        }),
        z.strictObject({
          collection: z.literal("requirements"),
          value: requirementSchema,
          reason: text,
        }),
        z.strictObject({
          collection: z.literal("acceptances"),
          value: acceptanceSchema,
          reason: text,
        }),
        z.strictObject({
          collection: z.literal("constraints"),
          value: constraintSchema,
          reason: text,
        }),
      ]),
    )
    .min(1),
});
export const draftInputSchema = z.strictObject({
  revision: z.number(),
  scope: scopeSchema,
});
export type Scope = z.infer<typeof scopeSchema>;
