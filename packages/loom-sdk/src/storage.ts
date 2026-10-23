import type { ReadonlyJsonValue } from "./json.ts";

export interface StoragePayload {
  readonly loomName: string;
  readonly stageName: string;
  readonly data: ReadonlyJsonValue;
}

export interface StoredArtifact {
  readonly id: string;
  readonly loomName: string;
  readonly stageName: string;
  /** Opaque positive safe integer; may skip values and is never reused after deletion. */
  readonly revision: number;
  readonly data: ReadonlyJsonValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredRecord {
  readonly id: string;
  readonly loomName: string;
  readonly stageName: string;
  readonly data: ReadonlyJsonValue;
  readonly createdAt: string;
}

export interface StorageQuery {
  readonly loomName?: string;
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

export interface StorageCommitResult {
  readonly writtenArtifacts: readonly StoredArtifact[];
  readonly appendedRecords: readonly StoredRecord[];
  readonly removedArtifactIds: readonly string[];
  readonly removedRecordIds: readonly string[];
}

export interface StorageReadAccess {
  getArtifact(
    loomName: string,
    stageName: string,
  ): Promise<StoredArtifact | undefined>;
  getArtifactById(id: string): Promise<StoredArtifact | undefined>;
  getLatestRecord(
    loomName: string,
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
