import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ZodType } from "zod";
import { failure } from "../errors.ts";
import {
  connectionSchema,
  serviceInfoSchema,
  serviceLockSchema,
  type ServiceConnection,
  type ServiceInfo,
  type ServiceLock,
} from "./contracts.ts";

export async function projectRoot(directory: string, searchParents = true) {
  let root = await realpath(resolve(directory)).catch((cause: unknown) => {
    throw failure(
      "CLI_PROJECT_INVALID",
      "The project directory does not exist.",
      cause,
    );
  });
  if (!(await stat(root)).isDirectory())
    throw failure(
      "CLI_PROJECT_INVALID",
      "The project path must be a directory.",
    );
  for (;;) {
    if (await hasProjectConfig(root)) return root;
    if (!searchParents || dirname(root) === root) break;
    root = dirname(root);
  }
  throw failure(
    "CLI_PROJECT_INVALID",
    "No IntLoom project found. Run intloom init in a new directory, or select a directory containing intloom.yaml.",
  );
}

async function hasProjectConfig(root: string) {
  const info = await stat(join(root, "intloom.yaml")).catch(
    (cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return undefined;
      throw cause;
    },
  );
  if (info && !info.isFile())
    throw failure("CLI_PROJECT_INVALID", "intloom.yaml must be a file.");
  return Boolean(info);
}

export function serviceDirectory(root: string) {
  return join(root, ".intloom");
}

export async function ensureServiceDirectory(root: string) {
  const directory = serviceDirectory(root);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (!(await lstat(directory)).isDirectory())
    throw failure(
      "CLI_PROJECT_INVALID",
      "The service directory must be an ordinary directory.",
    );
  return directory;
}

async function readPrivate<T>(
  filename: string,
  schema: ZodType<T>,
): Promise<T | undefined> {
  const info = await lstat(filename).catch((cause: unknown) => {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return undefined;
    throw cause;
  });
  if (!info) return undefined;
  if (
    !info.isFile() ||
    (process.platform !== "win32" && (info.mode & 0o077) !== 0)
  )
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "Service metadata must be a private ordinary file.",
    );
  const text = await readFile(filename, "utf8").catch((cause: unknown) => {
    // Shutdown may remove its service.json between lstat and readFile.
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return undefined;
    throw cause;
  });
  if (text === undefined) return undefined;
  try {
    return schema.parse(JSON.parse(text));
  } catch (cause) {
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "Service metadata is invalid.",
      cause,
    );
  }
}

async function checkServiceDirectory(root: string) {
  const info = await lstat(serviceDirectory(root)).catch((cause: unknown) => {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return undefined;
    throw cause;
  });
  if (info && !info.isDirectory())
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "The service directory must not be a symlink or ordinary file.",
    );
}

export async function readConnection(
  root: string,
): Promise<ServiceConnection | undefined> {
  await checkServiceDirectory(root);
  const value = await readPrivate(
    join(serviceDirectory(root), "connection.json"),
    connectionSchema,
  );
  if (value && value.projectRoot !== root)
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "The saved connection belongs to another project.",
    );
  return value;
}
export async function readServiceInfo(
  root: string,
): Promise<ServiceInfo | undefined> {
  await checkServiceDirectory(root);
  const value = await readPrivate(
    join(serviceDirectory(root), "service.json"),
    serviceInfoSchema,
  );
  if (value && value.projectRoot !== root)
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "The saved service belongs to another project.",
    );
  return value;
}

export async function readServiceLock(root: string) {
  await checkServiceDirectory(root);
  return readPrivate(
    join(serviceDirectory(root), "service.lock"),
    serviceLockSchema,
  );
}

export async function writeMetadata(
  root: string,
  name: "connection.json" | "service.json" | "service.lock",
  value: ServiceConnection | ServiceInfo | ServiceLock,
) {
  const directory = await ensureServiceDirectory(root);
  const temporary = join(directory, `${name}.${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, join(directory, name));
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Releases only its own lock; stale locks are not automatically deleted, and old PIDs are never used to kill processes. */
export async function acquireServiceLock(root: string, instanceId: string) {
  const directory = await ensureServiceDirectory(root);
  const filename = join(directory, "service.lock");
  const file = await open(filename, "wx", 0o600).catch((cause: unknown) => {
    throw failure(
      "CLI_SERVICE_BUSY",
      "The project service is locked. Run intloom doctor; use intloom recover only after its owner has exited.",
      cause,
    );
  });
  try {
    await file.writeFile(JSON.stringify({ pid: process.pid, instanceId }));
    await file.sync();
  } catch (cause) {
    await file.close();
    await rm(filename, { force: true });
    throw cause;
  }
  return async () => {
    await file.close();
    await releaseServiceLock(root, instanceId);
  };
}

async function releaseServiceLock(root: string, instanceId: string) {
  const lock = await readServiceLock(root);
  if (!lock || lock.pid !== process.pid || lock.instanceId !== instanceId)
    return;
  const info = await readServiceInfo(root);
  if (info?.instanceId === instanceId)
    await rm(join(serviceDirectory(root), "service.json"), { force: true });
  await rm(join(serviceDirectory(root), "service.lock"));
}

/** Caller holds the saved listening port; replace the stale lock without an unlocked startup gap. */
export async function claimServiceRecovery(
  root: string,
  expected: ServiceLock | undefined,
) {
  const instanceId = randomUUID();
  if (!expected) return acquireServiceLock(root, instanceId);
  const current = await readServiceLock(root);
  if (
    current?.pid !== expected.pid ||
    current?.instanceId !== expected.instanceId
  )
    throw failure(
      "CLI_RECOVERY_CONFLICT",
      "The service lock changed; run intloom doctor again.",
    );
  await writeMetadata(root, "service.lock", { pid: process.pid, instanceId });
  return () => releaseServiceLock(root, instanceId);
}
