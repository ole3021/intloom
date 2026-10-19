import * as z from "zod";
import { storeSchema } from "./file/store.ts";
import { artifactSchema, recordSchema } from "./schemas.ts";
import { jsonCopy } from "../shared/json.ts";

export const storageSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    backend: z.enum(["file", "sqlite"]),
    artifacts: z.array(artifactSchema),
    records: z.array(recordSchema),
    metadata: z.strictObject({
      revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      storeId: z.uuid().optional(),
      projectId: z.string().optional(),
    }),
  })
  .superRefine((snapshot, context) => {
    const result = storeSchema.safeParse({
      version: 1,
      storeId:
        snapshot.metadata.storeId ?? "00000000-0000-4000-8000-000000000000",
      revision: snapshot.metadata.revision,
      artifacts: snapshot.artifacts,
      records: snapshot.records,
    });
    if (!result.success)
      context.addIssue({ code: "custom", message: result.error.message });
    if (snapshot.backend === "file" && !snapshot.metadata.storeId)
      context.addIssue({
        code: "custom",
        message: "File snapshot requires storeId.",
      });
  });
export type LocalStorageSnapshot = z.infer<typeof storageSnapshotSchema>;
export function parseSnapshot(
  value: unknown,
  backend: "file" | "sqlite",
): LocalStorageSnapshot {
  const parsed = storageSnapshotSchema.parse(jsonCopy(value));
  if (parsed.backend !== backend)
    throw new Error("Snapshot backend differs from target backend.");
  return parsed;
}
