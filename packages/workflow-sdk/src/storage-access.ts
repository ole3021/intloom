import type {
  ListPage,
  StorageQuery,
  StorageCommitResult,
  StorageOperation,
  StoredArtifact,
  StoredRecord,
} from "./storage-types.ts";

export interface StorageReadAccess {
  getArtifact(
    flowName: string,
    stageName: string,
  ): Promise<StoredArtifact | undefined>;
  getArtifactById(id: string): Promise<StoredArtifact | undefined>;
  getLatestRecord(
    flowName: string,
    stageName: string,
  ): Promise<StoredRecord | undefined>;
  getRecordById(id: string): Promise<StoredRecord | undefined>;

  listArtifacts(query: StorageQuery): Promise<ListPage<StoredArtifact>>;
  listRecords(query: StorageQuery): Promise<ListPage<StoredRecord>>;
}

export interface StorageAccess extends StorageReadAccess {
  /** Atomic batch; duplicate category/ID targets are invalid. */
  commit(operations: readonly StorageOperation[]): Promise<StorageCommitResult>;
}
