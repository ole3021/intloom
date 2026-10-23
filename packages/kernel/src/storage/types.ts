export type StorageCategory = "artifacts" | "records";
export interface SnapshotResult {
  readonly artifactCount: number;
  readonly recordCount: number;
}
