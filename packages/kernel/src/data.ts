import { join } from "node:path";
import {
  loomIdSchema,
  type KeyValueStorage,
  type PackageIdentity,
} from "@intloom/loom-sdk";
import type {
  Installation,
  InstallationInput,
} from "./installations/contracts.ts";
import type {
  CompleteExecution,
  CreateExecution,
  ExecutionEvent,
  ExecutionQuery,
  ExecutionRecord,
} from "./executions/contracts.ts";
import type { Page, PageOptions } from "./persistence/pagination.ts";
import type { StoreHandle } from "./store/contracts.ts";
import { openDatabase } from "./persistence/database.ts";
import { systemSchema } from "./persistence/schema.ts";
import { migrateSystem } from "./persistence/migrations.ts";
import { installations } from "./installations/catalog.ts";
import { dataRoot, type DataOptions } from "./paths.ts";
import { records } from "./executions/records.ts";
import { openBoundStore } from "./store/sqlite.ts";
import { runRecords } from "./runs/records.ts";
import type { RunRecord, RunQuery, RunEvent } from "./runs/contracts.ts";

export interface KernelData {
  readonly dataDir: string;
  registerInstallation(input: InstallationInput): Promise<Installation>;
  getInstallation(identity: PackageIdentity): Promise<Installation | undefined>;
  getStore(loomId?: string): Promise<KeyValueStorage>;
  createExecution(input: CreateExecution): Promise<ExecutionRecord>;
  completeExecution(
    executionId: string,
    completion: CompleteExecution,
  ): Promise<ExecutionRecord>;
  getExecution(executionId: string): Promise<ExecutionRecord | undefined>;
  listExecutions(options?: ExecutionQuery): Promise<Page<ExecutionRecord>>;
  listEvents(
    executionId: string,
    options?: PageOptions,
  ): Promise<Page<ExecutionEvent>>;
  getRun(runId: string): Promise<RunRecord | undefined>;
  listRuns(options?: RunQuery): Promise<Page<RunRecord>>;
  listRunEvents(runId: string, options?: PageOptions): Promise<Page<RunEvent>>;
  close(): Promise<void>;
}

export async function openKernelData(
  options: DataOptions = {},
): Promise<KernelData> {
  return (await openDataResources(options)).data;
}

export async function openDataResources(options: DataOptions = {}) {
  const dataDir = await dataRoot(options);
  const database = await openDatabase(
    join(dataDir, "system.sqlite"),
    systemSchema,
    2,
    migrateSystem,
  );
  const packages = installations(database, dataDir);
  const executions = records(database, dataDir);
  const runs = runRecords(database, dataDir);
  const stores = new Map<string | undefined, Promise<StoreHandle>>();
  const pending = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;

  function ensureOpen() {
    if (closing) throw new Error("Kernel data is closed");
  }

  async function operation<T>(work: () => Promise<T>): Promise<T> {
    ensureOpen();
    const promise = work();
    pending.add(promise);
    try {
      return await promise;
    } finally {
      pending.delete(promise);
    }
  }

  const data: KernelData = {
    dataDir,
    registerInstallation(input) {
      return operation(() => packages.register(input));
    },
    async getInstallation(identity) {
      ensureOpen();
      return packages.get(identity);
    },
    getStore(loomId) {
      return operation(async () => {
        const owner = loomIdSchema.optional().parse(loomId);
        let opening = stores.get(owner);
        if (!opening) {
          opening = openBoundStore(dataDir, owner).catch((error: unknown) => {
            stores.delete(owner);
            throw error;
          });
          stores.set(owner, opening);
        }
        const handle = await opening;
        const store: KeyValueStorage = {
          get: handle.get,
          set: handle.set,
          delete: handle.delete,
          list: handle.list,
        };
        return store;
      });
    },
    async createExecution(input) {
      ensureOpen();
      return executions.create(input);
    },
    async completeExecution(executionId, completion) {
      ensureOpen();
      return executions.complete(executionId, completion);
    },
    async getExecution(executionId) {
      ensureOpen();
      return executions.get(executionId);
    },
    async listExecutions(options) {
      ensureOpen();
      return executions.list(options);
    },
    async listEvents(executionId, options) {
      ensureOpen();
      return executions.events(executionId, options);
    },
    async getRun(runId) {
      ensureOpen();
      return runs.get(runId);
    },
    async listRuns(options) {
      ensureOpen();
      return runs.list(options);
    },
    async listRunEvents(runId, options) {
      ensureOpen();
      return runs.events(runId, options);
    },
    close() {
      closing ??= (async () => {
        await Promise.allSettled(pending);
        try {
          await Promise.all(
            [...stores.values()].map(async (store) => (await store).close()),
          );
        } finally {
          database.close();
        }
      })();
      return closing;
    },
  };
  return { data, runs };
}
