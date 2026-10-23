import * as z from "zod";
const count = z.number().int().nonnegative();
const positive = z.number().int().positive();
export const runResultSchema = z.strictObject({
  kind: z.enum(["artifact", "record", "removed_artifact", "removed_record"]),
  id: z.string(),
  stageName: z.string(),
  stepName: z.string(),
  executionId: count,
  committedAt: z.iso.datetime(),
  revision: positive.optional(),
});
export type RunResult = z.infer<typeof runResultSchema>;
