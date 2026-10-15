export type {
  StorageQuery,
  ListPage,
  StoragePayload,
  StoredArtifact,
  StoredRecord,
  StorageOperation,
  StorageCommitResult,
} from "@intloom/loom-sdk";

export type StorageCategory = "artifacts" | "records";
export interface SnapshotResult {
  readonly artifactCount: number;
  readonly recordCount: number;
}
