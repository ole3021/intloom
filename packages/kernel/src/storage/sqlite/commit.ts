import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import { conflict, missing } from "../errors.ts";
import type {
  StorageOperation,
  StorageCommitResult,
  StoredArtifact,
  StoredRecord,
} from "../types.ts";
import { artifactKey, recordKey, readArtifact } from "./query.ts";
import { artifacts, records, projects } from "./schema.ts";

export function commitOperations(
  db: BetterSQLite3Database,
  projectId: string,
  operations: readonly StorageOperation[],
): StorageCommitResult {
  if (!operations.length)
    return {
      writtenArtifacts: [],
      appendedRecords: [],
      removedArtifactIds: [],
      removedRecordIds: [],
    };
  return db.transaction(
    (tx): StorageCommitResult => {
      const writtenArtifacts: StoredArtifact[] = [];
      const appendedRecords: StoredRecord[] = [];
      const removedArtifactIds: string[] = [];
      const removedRecordIds: string[] = [];
      const project = tx
        .select()
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .get();
      if (
        !project ||
        !Number.isSafeInteger(project.revision) ||
        project.revision < 0
      )
        throw KERNEL_ERRORS.create("STORAGE_ERROR", {
          message: "Invalid project revision metadata.",
        });
      let revision = project.revision;
      const now = new Date().toISOString();
      for (const operation of operations) {
        if (operation.type === "append_record") {
          const entry = {
            id: operation.id,
            ...operation.payload,
            createdAt: now,
          };
          tx.insert(records)
            .values({ ...entry, projectId })
            .run();
          appendedRecords.push(entry);
        } else if (operation.type === "remove_record") {
          if (
            tx.delete(records).where(recordKey(projectId, operation.id)).run()
              .changes !== 1
          )
            missing(operation.id);
          removedRecordIds.push(operation.id);
        } else {
          const row = tx
            .select()
            .from(artifacts)
            .where(artifactKey(projectId, operation.id))
            .get();
          const existing = row ? readArtifact(row) : undefined;
          if (operation.type === "create_artifact") {
            if (existing) conflict("Artifact ID already exists.");
          } else {
            if (!existing) missing(operation.id);
            if (existing.revision !== operation.expectedRevision)
              conflict("Artifact revision has changed.");
            if (operation.type === "remove_artifact") {
              if (
                tx
                  .delete(artifacts)
                  .where(
                    and(
                      artifactKey(projectId, operation.id),
                      eq(artifacts.revision, operation.expectedRevision),
                    ),
                  )
                  .run().changes !== 1
              )
                conflict("Artifact revision has changed.");
              removedArtifactIds.push(operation.id);
              continue;
            }
            if (
              existing.flowName !== operation.payload.flowName ||
              existing.stageName !== operation.payload.stageName
            )
              conflict("Artifact Workflow/Stage cannot change.");
          }
          if (revision === Number.MAX_SAFE_INTEGER)
            throw KERNEL_ERRORS.create("STORAGE_ERROR", {
              message: "Storage revision space exhausted.",
            });
          const entry: StoredArtifact = {
            ...operation.payload,
            id: operation.id,
            revision: ++revision,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          if (operation.type === "create_artifact")
            tx.insert(artifacts)
              .values({ ...entry, projectId })
              .run();
          else if (
            tx
              .update(artifacts)
              .set(entry)
              .where(
                and(
                  artifactKey(projectId, operation.id),
                  eq(artifacts.revision, operation.expectedRevision),
                ),
              )
              .run().changes !== 1
          )
            conflict("Artifact revision has changed.");
          writtenArtifacts.push(entry);
        }
      }
      if (revision !== project.revision)
        tx.update(projects)
          .set({ revision })
          .where(eq(projects.projectId, projectId))
          .run();
      return {
        writtenArtifacts,
        appendedRecords,
        removedArtifactIds,
        removedRecordIds,
      };
    },
    { behavior: "immediate" },
  );
}
