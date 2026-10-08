import type {
  StorageAccess,
  StorageCategory,
  SnapshotResult,
} from "@intloom/workflow-sdk";
export type { StorageAccess, StorageReadAccess } from "@intloom/workflow-sdk";

/** The host owns the implementation lifecycle and injects only access into execution environments and business calls. */
export interface StorageHandle {
  readonly access: StorageAccess;
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
