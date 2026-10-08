import { randomUUID } from "node:crypto";
import { logStorageAccess } from "../log-access.ts";
import { mkdir, open, readFile, readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { KERNEL_ERRORS } from "../../errors/kernel.ts";
import type { StorageAccess, StorageHandle } from "../contracts.ts";
import { storageError } from "../errors.ts";
import { createLifecycle } from "../lifecycle.ts";
import { comparePosition, matches, prepareQuery, toPage } from "../query.ts";
import { nameSchema, parseInput, parseOperations } from "../schemas.ts";
import type { StorageQuery, StoredRecord } from "../types.ts";
import { storeSchema, type FileStore } from "./store.ts";
import { publishStore } from "./publish.ts";
import { applyOperations } from "./apply-operations.ts";
import {
  readDirectoryStore,
  publishDirectoryStore,
} from "./directory-store.ts";

export {
  inspectFileStorageLock,
  recoverFileStorageLock,
  type FileStorageLock,
} from "./maintenance.ts";

export interface FileStorageOptions {
  readonly directory: string;
  readonly layout?: "single_file" | "directories";
}
/** Exclusive local directory; stale locks require explicit host/operator recovery. */
export async function openFileStorage(
  options: FileStorageOptions,
): Promise<StorageHandle> {
  const { directory, layout } = parseInput(
    z.strictObject({
      directory: z.string().min(1),
      layout: z.enum(["single_file", "directories"]).optional(),
    }),
    options,
  );
  let release: (() => Promise<void>) | undefined;
  try {
    await mkdir(directory, { recursive: true });
    const root = await realpath(directory);
    const lockPath = join(root, "store.lock");
    const lock = await open(lockPath, "wx", 0o600).catch((cause: unknown) => {
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "EEXIST"
      ) {
        throw KERNEL_ERRORS.wrap("BUSY", cause, {
          message:
            "Storage directory is locked; inspect store.lock before recovery.",
        });
      }
      throw cause;
    });
    release = async () => {
      await lock.close();
      await rm(lockPath);
    };
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    );
    await lock.sync();
    const filename = join(root, "store.json");
    const publish =
      layout === "directories" ? publishDirectoryStore : publishStore;
    let store: FileStore;
    const saved = await readFile(filename, "utf8").catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return undefined;
      throw cause;
    });
    if (saved !== undefined) {
      store =
        layout === "directories"
          ? await readDirectoryStore(root, JSON.parse(saved))
          : storeSchema.parse(JSON.parse(saved));
    } else {
      if (layout === "directories") {
        for (const category of ["artifacts", "records"]) {
          const entries = await readdir(join(root, category)).catch(
            (cause: unknown) => {
              if (
                cause instanceof Error &&
                "code" in cause &&
                cause.code === "ENOENT"
              )
                return [];
              throw cause;
            },
          );
          if (entries.length)
            throw new Error(
              "Storage manifest is missing but content exists; refusing to reset committed data",
            );
        }
      }
      store = {
        version: 1,
        storeId: randomUUID(),
        revision: 0,
        artifacts: [],
        records: [],
      };
      await publish(root, store, () => {});
    }
    const lifecycle = createLifecycle(release);
    let tail: Promise<unknown> = Promise.resolve();
    function list<T extends StoredRecord>(
      category: "artifacts" | "records",
      entries: readonly T[],
      input: StorageQuery,
    ) {
      return lifecycle.run(() => {
        const query = prepareQuery(input, store.storeId, category);
        const rows = [...entries]
          .filter((entry) => matches(entry, query))
          .sort(
            (a, b) =>
              comparePosition(a, b) * (query.order === "created_asc" ? 1 : -1),
          );
        return toPage(rows, query);
      });
    }
    const access: StorageAccess = Object.freeze<StorageAccess>({
      getArtifact: (flowName, stageName) =>
        lifecycle.run(() => {
          parseInput(nameSchema, flowName);
          parseInput(nameSchema, stageName);
          return structuredClone(
            store.artifacts.find(
              (entry) =>
                entry.flowName === flowName && entry.stageName === stageName,
            ),
          );
        }),
      getArtifactById: (id) =>
        lifecycle.run(() => {
          parseInput(nameSchema, id);
          return structuredClone(
            store.artifacts.find((entry) => entry.id === id),
          );
        }),
      getLatestRecord: (flowName, stageName) =>
        lifecycle.run(() => {
          parseInput(nameSchema, flowName);
          parseInput(nameSchema, stageName);
          return list("records", store.records, {
            flowName,
            stageName,
            limit: 1,
          }).then((page) => page.data[0]);
        }),
      getRecordById: (id) =>
        lifecycle.run(() => {
          parseInput(nameSchema, id);
          return structuredClone(
            store.records.find((entry) => entry.id === id),
          );
        }),
      listArtifacts: (query) => list("artifacts", store.artifacts, query),
      listRecords: (query) => list("records", store.records, query),
      commit: (input) =>
        lifecycle.run(() => {
          const operations = parseOperations(input);
          const result = tail.then(async () => {
            lifecycle.assertHealthy();
            const next = structuredClone(store);
            const written = applyOperations(next, operations);
            if (operations.length)
              await publish(root, next, (cause) => lifecycle.fail(cause));
            store = next;
            return structuredClone(written);
          });
          tail = result.catch(() => {});
          return result;
        }),
    });
    return Object.freeze({
      access: logStorageAccess(access),
      dispose: lifecycle.dispose,
    });
  } catch (cause) {
    try {
      await release?.();
    } catch (cleanup) {
      throw storageError(
        new AggregateError(
          [cause, cleanup],
          "Storage initialization and cleanup failed.",
        ),
      );
    }
    throw storageError(cause);
  }
}
