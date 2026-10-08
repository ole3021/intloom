import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isLoomError } from "@intloom/kernel";
import {
  inspectFileStorageLock,
  recoverFileStorageLock,
} from "@intloom/kernel/storage/file";
import { serviceStatus } from "../client/service-client.ts";
import { failure } from "../errors.ts";
import {
  claimServiceRecovery,
  projectRoot,
  readConnection,
  readServiceInfo,
  readServiceLock,
  serviceDirectory,
} from "./discovery.ts";
import type { ServiceStatus } from "./contracts.ts";

export interface ProjectDiagnosis {
  readonly projectRoot: string;
  readonly status: "running" | "offline" | "recovery_required" | "blocked";
  readonly message: string;
  readonly service?: ServiceStatus;
  readonly owners: readonly {
    readonly resource: "service_info" | "service_lock" | "storage_lock";
    readonly pid: number;
    readonly status: "alive" | "absent" | "unknown";
  }[];
}

function ownerStatus(pid: number): "alive" | "absent" | "unknown" {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (cause) {
    return cause instanceof Error && "code" in cause && cause.code === "ESRCH"
      ? "absent"
      : "unknown";
  }
}

async function inspect(root: string, probeEndpoint: boolean) {
  const connection = await readConnection(root);
  const info = await readServiceInfo(root);
  const serviceLock = await readServiceLock(root);
  const fileLock =
    (connection?.storage ?? info?.storage ?? "file") === "file"
      ? await inspectFileStorageLock({
          directory: join(root, "intloom"),
        })
      : undefined;
  const owners: ProjectDiagnosis["owners"] = [
    ...(info
      ? [
          {
            resource: "service_info" as const,
            pid: info.pid,
            status: ownerStatus(info.pid),
          },
        ]
      : []),
    ...(serviceLock
      ? [
          {
            resource: "service_lock" as const,
            pid: serviceLock.pid,
            status: ownerStatus(serviceLock.pid),
          },
        ]
      : []),
    ...(fileLock
      ? [
          {
            resource: "storage_lock" as const,
            pid: fileLock.pid,
            status: ownerStatus(fileLock.pid),
          },
        ]
      : []),
  ];
  let service: ServiceStatus | undefined;
  let problem: string | undefined;
  if (probeEndpoint && connection && info) {
    try {
      service = await serviceStatus(root);
    } catch (error) {
      if (!isLoomError(error) || error.code !== "CLI_SERVICE_OFFLINE")
        problem = isLoomError(error)
          ? error.message
          : "Cannot verify the service identity.";
    }
  }
  const status = service
    ? "running"
    : problem || owners.some((owner) => owner.status !== "absent")
      ? "blocked"
      : owners.length
        ? connection
          ? "recovery_required"
          : "blocked"
        : "offline";
  const diagnosis: ProjectDiagnosis = {
    projectRoot: root,
    status,
    owners,
    ...(service ? { service } : {}),
    message:
      status === "running"
        ? "The service is running."
        : status === "offline"
          ? "The service is offline. Run intloom start."
          : status === "recovery_required"
            ? "Found stale resources from an exited process. Run intloom recover, then intloom start."
            : (problem ??
              (!connection
                ? "Valid connection configuration is missing; recovery is unsafe. Check the project metadata."
                : "A resource owner still exists or its exit cannot be verified. No cleanup performed.")),
  };
  return {
    diagnosis,
    connection,
    info,
    serviceLock,
    fileLock,
  };
}

/** Read-only diagnosis; Runtime and Storage are not initialized. */
export async function diagnoseProject(
  directory: string,
): Promise<ProjectDiagnosis> {
  return (await inspect(await projectRoot(directory), true)).diagnosis;
}

function assertRecoverable(diagnosis: ProjectDiagnosis) {
  if (diagnosis.status === "running" || diagnosis.status === "blocked")
    throw failure("CLI_RECOVERY_BLOCKED", diagnosis.message);
}

function cleanupPaths(snapshot: Awaited<ReturnType<typeof inspect>>) {
  return [
    ...(snapshot.fileLock ? ["intloom/store.lock"] : []),
    ...(snapshot.info ? [".intloom/service.json"] : []),
    ...(snapshot.serviceLock ? [".intloom/service.lock"] : []),
  ];
}

export async function recoverProject(directory: string, dryRun = false) {
  const root = await projectRoot(directory);
  const initial = await inspect(root, true);
  assertRecoverable(initial.diagnosis);
  if (dryRun || initial.diagnosis.status === "offline")
    return {
      projectRoot: root,
      dryRun,
      recovered: false,
      paths: cleanupPaths(initial),
    };
  const connection = initial.connection;
  if (!connection)
    throw failure(
      "CLI_RECOVERY_BLOCKED",
      "Valid connection configuration is missing; recovery is unsafe.",
    );

  // The saved port serializes recovery commands without another persistent lock.
  // Keep service.lock occupied until cleanup and port release have both finished.
  const guard = createServer((_request, response) =>
    response.writeHead(503).end(),
  );
  await new Promise<void>((resolve, reject) => {
    guard.once("error", reject);
    guard.listen(connection.port, "127.0.0.1", () => {
      guard.off("error", reject);
      resolve();
    });
  }).catch((cause: unknown) => {
    throw failure(
      "CLI_RECOVERY_BLOCKED",
      "The project port is in use or unavailable. No recovery performed.",
      cause,
    );
  });
  let release: (() => Promise<void>) | undefined;
  try {
    const current = await inspect(root, false);
    assertRecoverable(current.diagnosis);
    if (current.diagnosis.status === "offline")
      return { projectRoot: root, dryRun: false, recovered: false, paths: [] };
    if (!isDeepStrictEqual(current.connection, connection))
      throw failure(
        "CLI_RECOVERY_CONFLICT",
        "Connection configuration changed. Run intloom doctor again.",
      );
    release = await claimServiceRecovery(root, current.serviceLock);
    if (current.fileLock)
      await recoverFileStorageLock({
        directory: join(root, "intloom"),
        expected: current.fileLock,
      });
    if (!isDeepStrictEqual(await readServiceInfo(root), current.info))
      throw failure(
        "CLI_RECOVERY_CONFLICT",
        "Service metadata changed. The new metadata was not removed.",
      );
    if (current.info) await rm(join(serviceDirectory(root), "service.json"));
    return {
      projectRoot: root,
      dryRun: false,
      recovered: true,
      paths: cleanupPaths(current),
    };
  } finally {
    try {
      await new Promise<void>((resolve, reject) => {
        guard.close((error) => (error ? reject(error) : resolve()));
        guard.closeAllConnections();
      });
    } finally {
      await release?.();
    }
  }
}
