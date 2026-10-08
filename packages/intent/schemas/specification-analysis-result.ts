import * as z from "zod";

export const specificationAnalysisResultSchema = z.strictObject({
  outcome: z.enum(["clarification_required", "ready"]),
});

export type SpecificationAnalysisResult = z.infer<
  typeof specificationAnalysisResultSchema
>;

export default specificationAnalysisResultSchema;
