import { contextSchema } from "../../../src/schema/common.ts";
import { implementationStateSchema } from "./state.ts";
import { specificationRecordSchema } from "../../specification/schema/record.ts";
import { solutionRecordSchema } from "../../solution/schema/record.ts";
export const implementationContextSchema = contextSchema.extend({
  ...implementationStateSchema.pick({
    baseline: true,
    candidate: true,
    changes: true,
    verifications: true,
    submission: true,
    observationRef: true,
  }).shape,
  basis: implementationStateSchema.shape.solutionRef,
  requirements: specificationRecordSchema.shape.snapshot.optional(),
  scope: specificationRecordSchema.shape.scope.optional(),
  design: solutionRecordSchema.shape.snapshot.optional(),
  plan: solutionRecordSchema.shape.plan.optional(),
});
