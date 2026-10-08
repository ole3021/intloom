import { getLogger, silentLogger, type LogFields } from "@intloom/utils";
import type { StorageAccess } from "./contracts.ts";

/** Records backend results after completion without serializing stored business data. */
export function logStorageAccess(access: StorageAccess): StorageAccess {
  const owner = getLogger();
  async function read<T>(
    operation: string,
    fields: LogFields,
    invoke: () => Promise<T>,
  ): Promise<T> {
    const current = getLogger();
    const log = current === silentLogger ? owner : current;
    const started = performance.now();
    try {
      const result = await invoke();
      log.debug("storage_read", {
        operation,
        ...fields,
        found: result !== undefined && result !== null,
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (cause) {
      log.debug("storage_read_failed", { operation });
      throw cause;
    }
  }
  return Object.freeze({
    getArtifact: (flowName, stageName) =>
      read("get_artifact", { flowName, stageName }, () =>
        access.getArtifact(flowName, stageName),
      ),
    getArtifactById: (id) =>
      read("get_artifact_by_id", { artifactId: id }, () =>
        access.getArtifactById(id),
      ),
    getLatestRecord: (flowName, stageName) =>
      read("get_latest_record", { flowName, stageName }, () =>
        access.getLatestRecord(flowName, stageName),
      ),
    getRecordById: (id) =>
      read("get_record_by_id", { recordId: id }, () =>
        access.getRecordById(id),
      ),
    listArtifacts: (query) =>
      read("list_artifacts", { limit: query.limit }, () =>
        access.listArtifacts(query),
      ),
    listRecords: (query) =>
      read("list_records", { limit: query.limit }, () =>
        access.listRecords(query),
      ),
    async commit(operations) {
      const current = getLogger();
      const log = current === silentLogger ? owner : current;
      const started = performance.now();
      log.debug("storage_commit_started", {
        operationCount: operations.length,
      });
      log.assertHealthy();
      owner.assertHealthy();
      try {
        const result = await access.commit(operations);
        log.info("storage_committed", {
          durationMs: Math.round(performance.now() - started),
          ...(result.writtenArtifacts.length
            ? {
                artifacts: result.writtenArtifacts.map(({ id, revision }) => ({
                  id,
                  revision,
                })),
              }
            : {}),
          ...(result.appendedRecords.length
            ? { records: result.appendedRecords.map(({ id }) => id) }
            : {}),
          ...(result.removedArtifactIds.length + result.removedRecordIds.length
            ? {
                removedCount:
                  result.removedArtifactIds.length +
                  result.removedRecordIds.length,
              }
            : {}),
        });
        return result;
      } catch (cause) {
        log.debug("storage_commit_failed");
        throw cause;
      }
    },
  } satisfies StorageAccess);
}
