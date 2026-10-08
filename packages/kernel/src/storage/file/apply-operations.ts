import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { conflict, missing } from "../errors.ts";
import { artifactSchema, recordSchema } from "../schemas.ts";
import type { StorageCommitResult, StorageOperation } from "../types.ts";
import type { FileStore } from "./store.ts";

export function applyOperations(
  store: FileStore,
  operations: readonly StorageOperation[],
): StorageCommitResult {
  const writtenArtifacts: FileStore["artifacts"] = [];
  const appendedRecords: FileStore["records"] = [];
  const removedArtifactIds: string[] = [];
  const removedRecordIds: string[] = [];
  const now = new Date().toISOString();
  for (const operation of operations) {
    if (operation.type === "append_record") {
      if (store.records.some((entry) => entry.id === operation.id))
        conflict("Record ID already exists.");
      const entry = recordSchema.parse({
        ...operation.payload,
        id: operation.id,
        createdAt: now,
      });
      store.records.push(entry);
      appendedRecords.push(entry);
    } else if (operation.type === "remove_record") {
      const index = store.records.findIndex(
        (entry) => entry.id === operation.id,
      );
      if (index < 0) missing(operation.id);
      store.records.splice(index, 1);
      removedRecordIds.push(operation.id);
    } else {
      const index = store.artifacts.findIndex(
        (entry) => entry.id === operation.id,
      );
      const existing = store.artifacts[index];
      if (operation.type === "create_artifact") {
        if (
          existing ||
          store.artifacts.some(
            (entry) =>
              entry.flowName === operation.payload.flowName &&
              entry.stageName === operation.payload.stageName,
          )
        )
          conflict("Artifact ID or Workflow/Stage already exists.");
      } else {
        if (!existing) missing(operation.id);
        if (existing.revision !== operation.expectedRevision)
          conflict("Artifact revision has changed.");
        if (operation.type === "remove_artifact") {
          store.artifacts.splice(index, 1);
          removedArtifactIds.push(operation.id);
          continue;
        }
        if (
          existing.flowName !== operation.payload.flowName ||
          existing.stageName !== operation.payload.stageName
        )
          conflict("Artifact Workflow/Stage cannot change.");
      }
      if (store.revision === Number.MAX_SAFE_INTEGER)
        throw KERNEL_ERRORS.create("STORAGE_ERROR", {
          message: "Storage revision space exhausted.",
        });
      const entry = artifactSchema.parse({
        ...operation.payload,
        id: operation.id,
        revision: ++store.revision,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      if (existing) store.artifacts[index] = entry;
      else store.artifacts.push(entry);
      writtenArtifacts.push(entry);
    }
  }
  return {
    writtenArtifacts,
    appendedRecords,
    removedArtifactIds,
    removedRecordIds,
  };
}
