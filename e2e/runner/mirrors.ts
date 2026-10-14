import * as z from "zod";
export const imageSchema = z
  .object({
    mirrorId: z.string(),
    traceId: z.string(),
    runId: z.string(),
    complete: z.boolean(),
    storageBackend: z.string(),
    boundary: z.object({
      kind: z.string(),
      stageName: z.string().optional(),
      stageVisitId: z.number(),
      stepName: z.string().optional(),
      stepVisitId: z.number(),
    }),
  })
  .passthrough();
export type Image = z.infer<typeof imageSchema>;
