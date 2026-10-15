import { contextSchema } from "../../../src/schema/common.ts";
import { specificationStateSchema } from "./state.ts";

export const specificationContextSchema = contextSchema.extend({
  ...specificationStateSchema.pick({
    baseline: true,
    analysis: true,
    draft: true,
    scope: true,
    aliases: true,
  }).shape,
});
