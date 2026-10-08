import * as z from "zod";
import { artifactSchema, recordSchema } from "../schemas.ts";

export const storeSchema = z
  .strictObject({
    version: z.literal(1),
    storeId: z.uuid(),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    artifacts: z.array(artifactSchema),
    records: z.array(recordSchema),
  })
  .superRefine((store, context) => {
    const ids = new Set<string>();
    const stages = new Set<string>();
    for (const item of store.artifacts) {
      const stage = JSON.stringify([item.flowName, item.stageName]);
      if (
        ids.has(item.id) ||
        stages.has(stage) ||
        item.revision > store.revision
      ) {
        context.addIssue({
          code: "custom",
          message: "Invalid Artifact identity or revision",
        });
      }
      ids.add(item.id);
      stages.add(stage);
    }
    ids.clear();
    for (const item of store.records) {
      if (ids.has(item.id))
        context.addIssue({ code: "custom", message: "Duplicate Record ID" });
      ids.add(item.id);
    }
  });
export type FileStore = z.infer<typeof storeSchema>;
