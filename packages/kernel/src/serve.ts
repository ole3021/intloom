import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { customAlphabet } from "nanoid";
import { IntloomError } from "@intloom/loom-sdk";
import { PackageError } from "@intloom/loom-sdk/package-format";
import type { Kernel, ServeOptions } from "./api-contracts.ts";
import { createKernelApi, validateServeOptions } from "./api.ts";
import { loadConfiguration } from "./execution/config.ts";
import { createKernel } from "./lifecycle/coordinator.ts";
import { createPackageStore } from "./packages/store.ts";
import { createLoomCatalog } from "./packages/catalog.ts";
import { openStorage } from "./persistence/storage.ts";
import { createLoomRuntime } from "./execution/loom.ts";
import { openMastraRuntime } from "./mastra/index.ts";
import { createOutcomeServices } from "./outcomes/service.ts";

export type { Kernel, ServeOptions } from "./api-contracts.ts";
const runSuffix = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 5);
export async function serve(options: ServeOptions): Promise<Kernel> {
  validateServeOptions(options);
  const projectDir = options.projectDir
    ? resolve(options.projectDir)
    : undefined;
  const bindings = async (root: string | undefined, needsModels: boolean) =>
    needsModels
      ? loadConfiguration(root ?? dataDir, options.bindings ?? {}, dataDir)
      : (options.bindings ?? {});
  const dataDir = resolve(options.dataDir);
  const packages = await createPackageStore({ dataDir }).catch(
    (error: unknown) => {
      if (error instanceof PackageError && error.code === "DATA_DIR_IN_USE")
        throw new IntloomError(
          "SERVICE_BUSY",
          "The Intloom service is already running.",
        );
      throw new IntloomError(
        error instanceof PackageError ? error.code : "STORAGE_FAILED",
        "The local package store could not be opened.",
      );
    },
  );
  const repository = await openStorage(dataDir, options.onRunEvents).catch(
    async (error: unknown) => {
      await packages.close();
      throw error;
    },
  );
  const engines = new Map<
    string,
    Promise<Awaited<ReturnType<typeof openMastraRuntime>>>
  >();
  const engineFor = (
    record: import("./lifecycle/run-contracts.ts").RunRecord,
  ) => {
    const directory = record.binding.location.dataDir;
    let engine = engines.get(directory);
    if (!engine) {
      engine = mkdir(directory, { recursive: true }).then(() =>
        openMastraRuntime(pathToFileURL(join(directory, "mastra.db")).href),
      );
      engines.set(directory, engine);
    }
    return engine;
  };
  const closeStorage = async () => {
    const opened = await Promise.allSettled(engines.values());
    try {
      await repository.close();
    } finally {
      try {
        await Promise.all(
          opened.map((handle) =>
            handle.status === "fulfilled" ? handle.value.close() : undefined,
          ),
        );
      } finally {
        await packages.close();
      }
    }
  };
  const outcomes = createOutcomeServices({
    repository,
    directory: repository.directory,
    id: randomUUID,
    now: () => new Date().toISOString(),
  });
  const kernel = await createKernel({
    repository,
    outcomes,
    runtime: createLoomRuntime(packages, bindings, engineFor, dataDir),
    id: randomUUID,
    runId: () => `R${runSuffix()}`,
    markStopped: repository.markStopped,
    wasStopped: repository.wasStopped,
    now: () => new Date().toISOString(),
  }).catch(async (error: unknown) => {
    await closeStorage();
    throw error;
  });
  let closing: Promise<void> | undefined;
  let closed = false;
  const observationClosed = new AbortController();
  function close(cancelRuns: boolean): Promise<void> {
    closing ??= (async () => {
      try {
        await kernel.close(cancelRuns);
      } finally {
        observationClosed.abort();
        closed = true;
        await closeStorage();
      }
    })();
    return closing;
  }
  const available = () => {
    if (closed)
      throw new IntloomError("SERVICE_BUSY", "The Intloom service has closed.");
  };
  return createKernelApi({
    kernel,
    repository,
    packages,
    outcomes,
    catalog: createLoomCatalog(packages),
    projectDir,
    available,
    isClosing: () => Boolean(closing),
    close,
    observationClosed: observationClosed.signal,
  });
}
