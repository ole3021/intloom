import * as z from "zod";
import { text, refs, analysisSchema } from "../../../src/schema/common.ts";
import {
  verificationSchema,
  targetRefSchema,
} from "../../../src/schema/verification.ts";
import { designObjectSchema, designConstraintSchema } from "./artifact.ts";
export const planSchema = z.strictObject({
  implementationItems: z
    .array(
      z.strictObject({
        id: text,
        description: text,
        designRefs: refs,
        dependsOn: refs,
        explanation: text,
      }),
    )
    .min(1),
  verifications: z.array(verificationSchema),
  engineeringTargets: z.array(z.strictObject({ id: text, description: text })),
  coverage: z
    .array(
      z.strictObject({
        workItemRef: text,
        target: targetRefSchema,
        implementationRefs: refs.min(1),
        verificationRefs: refs.min(1),
        explanation: text,
      }),
    )
    .min(1),
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
          collection: z.literal("objects"),
          value: designObjectSchema,
          reason: text,
        }),
        z.strictObject({
          collection: z.literal("constraints"),
          value: designConstraintSchema,
          reason: text,
        }),
      ]),
    )
    .min(1),
});
export const designInputSchema = z.strictObject({
  revision: z.number(),
  plan: planSchema,
});
export type Plan = z.infer<typeof planSchema>;
