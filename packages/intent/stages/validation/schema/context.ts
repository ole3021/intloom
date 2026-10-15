import { contextSchema } from "../../../src/schema/common.ts";
import { validationStateSchema } from "./state.ts";
import { implementationRecordSchema } from "../../implementation/schema/record.ts";
export const validationContextSchema = contextSchema.extend({
  ...validationStateSchema.pick({
    candidate: true,
    targets: true,
    verifications: true,
    history: true,
    collectionDecisions: true,
    observationRef: true,
  }).shape,
  basis: validationStateSchema.shape.implementationRef,
  delivery: implementationRecordSchema.shape.delivery.optional(),
  draft: validationStateSchema.shape.submission,
});
