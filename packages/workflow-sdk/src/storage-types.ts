import type { ReadonlyJsonValue } from "./json.ts";

// #region Stored Data
export interface StoragePayload {
  readonly flowName: string;
  readonly stageName: string;
  readonly data: ReadonlyJsonValue;
}

export interface StoredArtifact {
  readonly id: string;
  readonly flowName: string;
  readonly stageName: string;
  /** Opaque positive safe integer; may skip values and is never reused after deletion. */
  readonly revision: number;
  readonly data: ReadonlyJsonValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredRecord {
  readonly id: string;
  readonly flowName: string;
  readonly stageName: string;
  readonly data: ReadonlyJsonValue;
  readonly createdAt: string;
}
// #endregion

// #region StorageQuery
export interface StorageQuery {
  readonly flowName?: string;
  readonly stageName?: string;
  readonly ids?: readonly string[];
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly order?: "created_asc" | "created_desc";
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListPage<Entry> {
  readonly data: readonly Entry[];
  readonly nextCursor?: string;
}
// #endregion

// #region StorageOperation
export type StorageOperation =
  | {
      readonly type: "create_artifact";
      readonly id: string;
      readonly payload: StoragePayload;
    }
  | {
      readonly type: "replace_artifact";
      readonly id: string;
      readonly expectedRevision: number;
      readonly payload: StoragePayload;
    }
  | {
      readonly type: "append_record";
      readonly id: string;
      readonly payload: StoragePayload;
    }
  | {
      readonly type: "remove_artifact";
      readonly id: string;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "remove_record";
      readonly id: string;
    };

// #endregion

// #region StorageCommitResult
export interface StorageCommitResult {
  readonly writtenArtifacts: readonly StoredArtifact[];
  readonly appendedRecords: readonly StoredRecord[];
  readonly removedArtifactIds: readonly string[];
  readonly removedRecordIds: readonly string[];
}
// #endregion

// #region Snapshot
export type StorageCategory = "artifacts" | "records";

export interface SnapshotResult {
  readonly artifactCount: number;
  readonly recordCount: number;
}
// #endregion

/** @deprecated Use StorageQuery. Retained for existing consumers. */
export type Query = StorageQuery;
/** @deprecated Use StorageCategory. Retained for existing consumers. */
export type SnapshotCategory = StorageCategory;
