import { contextSchema } from "../../../src/schema/common.ts";
import { solutionStateSchema } from "./state.ts";
import { specificationRecordSchema } from "../../specification/schema/record.ts";
export const solutionContextSchema = contextSchema.extend({
  ...solutionStateSchema.pick({
    specificationRef: true,
    baseline: true,
    analysis: true,
    draft: true,
    plan: true,
    aliases: true,
  }).shape,
  requirements: specificationRecordSchema.shape.snapshot.optional(),
  scope: specificationRecordSchema.shape.scope.optional(),
});
