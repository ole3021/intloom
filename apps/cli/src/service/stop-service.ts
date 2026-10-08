import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isLoomError } from "@intloom/kernel";
import {
  inspectFileStorageLock,
  type FileStorageLock,
} from "@intloom/kernel/storage/file";
import { controlRequest, serviceStatus } from "../client/service-client.ts";
import { failure } from "../errors.ts";
import {
  projectRoot,
  readConnection,
  readServiceInfo,
  readServiceLock,
} from "./discovery.ts";
import { serviceUrl, type ServiceLock } from "./contracts.ts";
import { diagnoseProject } from "./recovery.ts";

export interface StopServiceResult {
  readonly projectRoot: string;
  /** true confirms the observed instance stopped; false means it was already normally offline. Both are successful. */
  readonly stopped: boolean;
}

interface StopTarget extends ServiceLock {
  readonly fileLock?: FileStorageLock;
}

/** Binds the observed instance without resending requests, taking over new instances, or cleaning up stale resources. */
export async function stopService(
  directory: string,
): Promise<StopServiceResult> {
  const root = await projectRoot(directory);
  const info = await readServiceInfo(root);
  const lock = await readServiceLock(root);
  const connection = await readConnection(root);
  const observed = info ?? lock;
  if (!observed) {
    const diagnosis = await diagnoseProject(root);
    if (diagnosis.status === "offline")
      return { projectRoot: root, stopped: false };
    throw failure(
      "CLI_SERVICE_BUSY",
      `${diagnosis.message} Run intloom doctor to inspect the service.`,
    );
  }
  if (
    info &&
    lock &&
    (info.instanceId !== lock.instanceId || info.pid !== lock.pid)
  )
    throw failure(
      "CLI_SERVICE_CONFLICT",
      "Service identity changed during inspection. Check the status again.",
    );
  if (
    !connection ||
    (info &&
      (info.url !== serviceUrl(connection) ||
        info.storage !== connection.storage))
  )
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "Service identity does not match connection configuration. Shutdown was not requested.",
    );

  const fileLock =
    connection.storage === "file"
      ? await inspectFileStorageLock({
          directory: join(root, "intloom"),
        })
      : undefined;
  const target: StopTarget = {
    pid: observed.pid,
    instanceId: observed.instanceId,
    ...(fileLock ? { fileLock } : {}),
  };
  if (fileLock && fileLock.pid !== target.pid)
    throw failure(
      "CLI_SERVICE_CONFLICT",
      "The storage lock owner does not match the original service. Shutdown was not requested; run intloom doctor.",
    );
  const deadline = Date.now() + 10_000;
  if (info) {
    try {
      const status = await serviceStatus(root);
      if (
        status.instanceId === target.instanceId &&
        status.pid === target.pid
      ) {
        const response = await controlRequest(
          connection,
          "/_stop",
          target.instanceId,
        );
        if (!response.ok && response.status !== 503) {
          if (response.status === 409 && (await released(root, target)))
            return { projectRoot: root, stopped: true };
          throw failure(
            response.status === 409
              ? "CLI_SERVICE_CONFLICT"
              : "CLI_SERVICE_UNAVAILABLE",
            `The service rejected shutdown (${response.status}).`,
          );
        }
      }
    } catch (error) {
      if (
        isLoomError(error) &&
        error.code === "CLI_SERVICE_METADATA_INVALID" &&
        (await released(root, target))
      )
        return { projectRoot: root, stopped: true };
      // Another shutdown call may close the connection first; observe the original instance's cleanup without resending stop.
      if (
        !isLoomError(error) ||
        !["CLI_SERVICE_OFFLINE", "CLI_SERVICE_CLOSING"].includes(error.code)
      )
        throw error;
    }
  }
  while (Date.now() < deadline) {
    if (await released(root, target))
      return { projectRoot: root, stopped: true };
    try {
      process.kill(target.pid, 0);
    } catch (cause) {
      // The instance can finish cleanup between the resource snapshot and this liveness check.
      if (await released(root, target))
        return { projectRoot: root, stopped: true };
      throw failure(
        "CLI_SERVICE_BUSY",
        "Cannot verify resource cleanup by the original instance. Run intloom doctor and explicitly recover if needed.",
        cause,
      );
    }
    await delay(50);
  }
  throw failure(
    "CLI_SERVICE_TIMEOUT",
    "Cannot verify resource cleanup by the original instance. Run intloom doctor. The stop request was not resent.",
  );
}

async function released(root: string, target: StopTarget) {
  const info = await readServiceInfo(root);
  const lock = await readServiceLock(root);
  const fileLock = target.fileLock
    ? await inspectFileStorageLock({
        directory: join(root, "intloom"),
      })
    : undefined;
  return (
    info?.instanceId !== target.instanceId &&
    lock?.instanceId !== target.instanceId &&
    (!target.fileLock || !isDeepStrictEqual(fileLock, target.fileLock))
  );
}
