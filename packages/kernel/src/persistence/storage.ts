import { createClient } from "@libsql/client";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  IntloomError,
  type RunEventsCommitted,
  type StorageIssue,
} from "@intloom/loom-sdk";
import type { RunRepository } from "../lifecycle/run-contracts.ts";
import { openRunRepository } from "./runs.ts";

/** Global metadata locates records and retains stop intent when a project is unavailable. */
export async function openStorage(
  globalDir: string,
  notify?: (notice: RunEventsCommitted) => void,
) {
  const index = createClient({
    url: pathToFileURL(join(globalDir, "index.db")).href,
  });
  await index.executeMultiple(`
    CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, directory TEXT NOT NULL, kind TEXT NOT NULL, parent_id TEXT);
    CREATE TABLE IF NOT EXISTS stores (directory TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS stopped_runs (id TEXT PRIMARY KEY);
  `);
  const locations = new Map(
    (await index.execute("SELECT * FROM locations")).rows.map((row) => [
      String(row.id),
      {
        directory: String(row.directory),
        kind: String(row.kind),
        parent: row.parent_id === null ? undefined : String(row.parent_id),
      },
    ]),
  );
  const directories = new Set(
    (await index.execute("SELECT directory FROM stores")).rows.map((row) =>
      String(row.directory),
    ),
  );
  const stopped = new Set(
    (await index.execute("SELECT id FROM stopped_runs")).rows.map((row) =>
      String(row.id),
    ),
  );
  const stores = new Map<
    string,
    Promise<Awaited<ReturnType<typeof openRunRepository>>>
  >();
  const issues = new Map<string, StorageIssue>();
  const listeners = new Set<(notice: RunEventsCommitted) => void>();
  if (notify) listeners.add(notify);
  const invoke = async <T>(
    directory: string,
    action: (
      store: Awaited<ReturnType<typeof openRunRepository>>,
    ) => Promise<T>,
    create = false,
  ): Promise<T> => {
    const issue = issues.get(directory);
    if (issue)
      throw new IntloomError("STORAGE_UNAVAILABLE", issue.message, {
        directory,
      });
    try {
      let pending = stores.get(directory);
      if (!pending) {
        pending = (async () => {
          if (create && !directories.has(directory))
            await mkdir(directory, { recursive: true });
          else if (!(await stat(join(directory, "kernel.db"))).isFile())
            throw new Error("Run database is not a file.");
          return openRunRepository(join(directory, "kernel.db"), (notice) => {
            for (const listener of listeners) listener(notice);
          });
        })();
        stores.set(directory, pending);
      }
      return await action(await pending);
    } catch (error) {
      if (
        error instanceof IntloomError &&
        !["STORAGE_FAILED", "STORAGE_INCOMPATIBLE"].includes(error.code)
      )
        throw error;
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      const message = `${missing ? "Missing" : "Unavailable"} Run storage: ${directory}. Restore the original database and permissions, then run intloom shutdown and intloom startup. Existing data has not been replaced.`;
      issues.set(directory, {
        directory,
        code: missing ? "STORAGE_MISSING" : "STORAGE_UNAVAILABLE",
        message,
      });
      throw new IntloomError("STORAGE_UNAVAILABLE", message, { directory });
    }
  };
  const directoryFor = (id: string) => {
    const location = locations.get(id);
    if (!location)
      throw new IntloomError("RUN_NOT_FOUND", "Record was not found.", { id });
    return location.directory;
  };
  const locate = async (
    id: string,
    directory: string,
    kind: string,
    parent?: string,
  ) => {
    if (locations.has(id)) return;
    try {
      await index.batch(
        [
          { sql: "INSERT OR IGNORE INTO stores VALUES (?)", args: [directory] },
          {
            sql: "INSERT INTO locations VALUES (?, ?, ?, ?)",
            args: [id, directory, kind, parent ?? null],
          },
        ],
        "write",
      );
    } catch {
      throw new IntloomError(
        "STORAGE_FAILED",
        `Cannot update the global Run index in ${globalDir}. Check disk space and permissions.`,
      );
    }
    locations.set(id, { directory, kind, parent });
    directories.add(directory);
  };
  const collect = async <T>(
    read: (
      store: Awaited<ReturnType<typeof openRunRepository>>,
    ) => Promise<readonly T[]>,
  ) =>
    (
      await Promise.all(
        [...directories].map(async (directory) => {
          try {
            return await invoke(directory, read);
          } catch (error) {
            if (
              error instanceof IntloomError &&
              error.code === "STORAGE_UNAVAILABLE"
            )
              return [];
            throw error;
          }
        }),
      )
    ).flat();
  const repository: RunRepository = {
    get: async (id) =>
      locations.has(id)
        ? invoke(directoryFor(id), (store) => store.get(id))
        : undefined,
    listUnfinished: () => collect((store) => store.listUnfinished()),
    async findInteraction(requestId) {
      const location = locations.get(requestId);
      if (location)
        return invoke(location.directory, (store) =>
          store.findInteraction(requestId),
        );
      // Older stores already have a derived local request index; register its locator on first access.
      const records = await collect(async (store) => {
        const record = await store.findInteraction(requestId);
        return record ? [record] : [];
      });
      const record = records[0];
      if (record)
        await locate(
          requestId,
          record.binding.location.dataDir,
          "interaction",
          record.view.id,
        );
      return record;
    },
    async listViews(options) {
      return (await collect((store) => store.listViews(options)))
        .sort((a, b) =>
          `${a.createdAt}/${a.id}`.localeCompare(`${b.createdAt}/${b.id}`),
        )
        .slice(0, options.limit);
    },
    async save(record, events, operation, related = []) {
      for (const item of [record, ...related]) {
        const directory = item.binding.location.dataDir;
        await invoke(directory, async () => {}, true);
        await locate(item.view.id, directory, "run", item.view.parentRunId);
        for (const { request } of item.interactions ?? [])
          await locate(request.id, directory, "interaction", item.view.id);
      }
      await invoke(directoryFor(record.view.id), (store) =>
        store.save(record, events, operation, related),
      );
    },
    log: (id, event) =>
      invoke(directoryFor(id), (store) => store.log(id, event)),
    events: (id, after, limit) =>
      invoke(directoryFor(id), (store) => store.events(id, after, limit)),
    snapshot: async (id) =>
      locations.has(id)
        ? invoke(directoryFor(id), (store) => store.snapshot(id))
        : undefined,
    async saveArtifact(record) {
      const directory = directoryFor(record.runId);
      await locate(record.id, directory, "artifact");
      await invoke(directory, (store) => store.saveArtifact(record));
    },
    getArtifact: async (id) =>
      locations.has(id)
        ? invoke(directoryFor(id), (store) => store.getArtifact(id))
        : undefined,
    async listArtifacts(options) {
      if (options.runId)
        return invoke(directoryFor(options.runId), (store) =>
          store.listArtifacts(options),
        );
      return (await collect((store) => store.listArtifacts(options)))
        .sort((a, b) =>
          `${a.createdAt}/${a.id}`.localeCompare(`${b.createdAt}/${b.id}`),
        )
        .slice(0, options.limit);
    },
    async saveAcceptance(record) {
      const directory = directoryFor(record.runId);
      await locate(record.id, directory, "acceptance");
      await invoke(directory, (store) => store.saveAcceptance(record));
    },
    getAcceptance: async (id) =>
      locations.has(id)
        ? invoke(directoryFor(id), (store) => store.getAcceptance(id))
        : undefined,
    listAcceptances: (options) =>
      invoke(directoryFor(options.runId), (store) =>
        store.listAcceptances(options),
      ),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    ...repository,
    async overview() {
      const pages = await collect(async (store) => [await store.overview()]);
      return {
        totalRuns: pages.reduce((total, page) => total + page.totalRuns, 0),
        recent: pages
          .flatMap((page) => page.recent)
          .sort(
            (a, b) =>
              (b.finishedAt ?? b.updatedAt).localeCompare(
                a.finishedAt ?? a.updatedAt,
              ) || b.id.localeCompare(a.id),
          )
          .slice(0, 10),
      };
    },
    directory: directoryFor,
    issues: () => [...issues.values()],
    wasStopped: (id: string) => stopped.has(id),
    async markStopped(root?: string) {
      const selected = new Set<string>();
      for (const [id, location] of locations)
        if (location.kind === "run" && (root === undefined || id === root))
          selected.add(id);
      if (root !== undefined) {
        let previous = -1;
        while (previous !== selected.size) {
          previous = selected.size;
          for (const [id, location] of locations)
            if (
              location.kind === "run" &&
              location.parent &&
              selected.has(location.parent)
            )
              selected.add(id);
        }
      }
      const added = [...selected].filter((id) => !stopped.has(id));
      if (added.length) {
        try {
          await index.batch(
            added.map((id) => ({
              sql: "INSERT OR IGNORE INTO stopped_runs VALUES (?)",
              args: [id],
            })),
            "write",
          );
        } catch {
          throw new IntloomError(
            "STORAGE_FAILED",
            `Cannot save stop requests in ${globalDir}. Check disk space and permissions; shutdown has not been confirmed.`,
          );
        }
        for (const id of added) stopped.add(id);
      }
    },
    async close() {
      for (const result of await Promise.allSettled(stores.values()))
        if (result.status === "fulfilled") result.value.close();
      listeners.clear();
      index.close();
    },
  };
}
