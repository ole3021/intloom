import * as z from "zod";
import { text } from "../../../src/schema/common.ts";
export const validationArtifactSchema = z.strictObject({
  records: z.array(
    z.strictObject({
      recordRef: text,
      publicationOrder: z.number().int().positive(),
    }),
  ),
  latestRound: z
    .strictObject({
      recordRef: text,
      candidateRef: text,
      verdict: z.enum(["passed", "failed", "partial", "undone"]),
    })
    .nullable(),
  targetIndex: z.array(
    z.strictObject({ targetKey: text, latestAssessmentRef: text }),
  ),
  findingIndex: z.array(
    z.strictObject({
      findingRef: text,
      latestAssessmentRef: text,
      lastDefiniteAssessmentRef: text.optional(),
    }),
  ),
});
export type ValidationArtifact = z.infer<typeof validationArtifactSchema>;
export default validationArtifactSchema;
