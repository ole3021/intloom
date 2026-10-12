import type {
  StorageAccess,
  StorageCategory,
  SnapshotResult,
} from "@intloom/workflow-sdk";
export type { StorageAccess, StorageReadAccess } from "@intloom/workflow-sdk";

/** The host owns the implementation lifecycle and injects only access into execution environments and business calls. */
export interface StorageHandle {
  readonly access: StorageAccess;
  readonly backend?: "file" | "sqlite";
  readonly location?: string;
  /** Host-only complete formal data, bypassing commit revision generation. */
  exportSnapshot?(): Promise<import("./snapshot.ts").LocalStorageSnapshot>;
  importSnapshot?(
    snapshot: import("./snapshot.ts").LocalStorageSnapshot,
  ): Promise<void>;
  /** Implementations own in-flight operations and release resources idempotently; incomplete writes are not treated as committed. */
  dispose(): Promise<void>;
}

export interface StorageSnapshot {
  exportTo(
    directory: string,
    categories?: readonly StorageCategory[],
  ): Promise<SnapshotResult>;

  importFrom(
    directory: string,
    categories?: readonly StorageCategory[],
  ): Promise<SnapshotResult>;
}
