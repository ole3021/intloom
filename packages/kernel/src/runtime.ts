import { randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLoomInputSchema, type RunResult } from "@intloom/loom-sdk";
import { z } from "zod";
import { openDataResources, type KernelData } from "./data.ts";
import { isWithin, runDirectory, type DataOptions } from "./paths.ts";
import {
  environmentSchema,
  RunInterruptedError,
  startRunSchema,
  type RunEvent,
  type RunRecord,
  type StartRunInput,
} from "./runs/contracts.ts";
import { finalizeRun, RunLifecycle } from "./runs/lifecycle.ts";
import type { SubmissionResult } from "./tools/interactions.ts";

export interface RuntimeOptions extends DataOptions {
  readonly nodePath?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly cancellationGraceMs?: number;
}
export interface ObserveRunOptions {
  readonly cursor?: string;
  readonly signal?: AbortSignal;
}
export interface KernelRuntime extends KernelData {
  startRun(input: StartRunInput): Promise<{ readonly runId: string }>;
  observeRun(
    runId: string,
    options?: ObserveRunOptions,
  ): AsyncIterableIterator<RunEvent>;
  submitAnswer(
    interactionId: string,
    answer: unknown,
  ): Promise<SubmissionResult>;
  cancelRun(runId: string, reason?: string): Promise<void>;
  waitRun(runId: string): Promise<RunResult>;
  finalizeInterruptedRun(
    runId: string,
    confirmation: { readonly processesStopped: true },
  ): Promise<RunResult>;
}

export async function openKernel(
  options: RuntimeOptions = {},
): Promise<KernelRuntime> {
  const config = z
    .strictObject({
      dataDir: z.string().optional(),
      nodePath: z.string().min(1).default(process.execPath),
      env: environmentSchema.default({}),
      cancellationGraceMs: z.number().int().nonnegative().default(2000),
    })
    .parse(options);
  if (process.platform !== "darwin" && process.platform !== "linux")
    throw new Error("Code runtime supports macOS and Linux");
  if (process.versions.bun && !options.nodePath)
    throw new Error(
      "A Node executable is required when the host runs under Bun",
    );
  const { data, runs } = await openDataResources(
    config.dataDir === undefined ? {} : { dataDir: config.dataDir },
  );
  const owner = { id: randomUUID(), pid: process.pid };
  try {
    runs.claim(owner);
  } catch (error) {
    await data.close();
    throw error;
  }
  const active = new Map<string, RunLifecycle>();
  const starting = new Set<Promise<unknown>>();
  const finalizing = new Map<string, Promise<RunResult>>();
  const observing = new AbortController();
  let closing: Promise<void> | undefined;
  const ensureOpen = () => {
    if (closing) throw new Error("Kernel runtime is closed");
  };

  async function start(raw: StartRunInput): Promise<{ runId: string }> {
    const request = startRunSchema.parse(raw);
    const installation = await data.getInstallation(request.package);
    if (!installation)
      throw new Error("Run requires a registered installation");
    if (installation.manifest.entry.kind !== "code")
      throw new Error("This runtime executes Code entries only");
    const input = createLoomInputSchema(installation.manifest.input).parse(
      request.input,
    );
    const normalized = { ...input };
    for (const field of ["files", "folders"] as const) {
      if (input[field] !== undefined)
        normalized[field] = await Promise.all(
          input[field].map(async (path) => {
            const actual = await realpath(path);
            const info = await stat(actual);
            if (field === "files" ? !info.isFile() : !info.isDirectory())
              throw new Error(`Expected ${field}: ${path}`);
            return actual;
          }),
        );
    }
    const scope = installation.manifest.execution.scope;
    const runId = randomUUID();
    const directory = runDirectory(
      data.dataDir,
      installation.package.name,
      runId,
    );
    let workDir = join(directory, "work");
    if (scope === "workspace") {
      if (!request.workDir)
        throw new Error("Workspace Run requires an existing workDir");
      workDir = await realpath(resolve(request.workDir));
      if (!(await stat(workDir)).isDirectory())
        throw new Error("workDir must be a directory");
      if (isWithin(data.dataDir, workDir))
        throw new Error("Workspace workDir must be outside internal data");
    } else if (request.workDir !== undefined)
      throw new Error("intloom Run allocates its own workDir");
    const at = new Date().toISOString();
    const run: RunRecord = {
      runId,
      package: installation.package,
      input: normalized,
      owner,
      scope,
      workDir,
      tempDir: join(directory, "temp"),
      phase: "preparing",
      createdAt: at,
      updatedAt: at,
      processes: [],
      interactions: [],
      cleanupFailures: [],
    };
    runs.create(run);
    const lifecycle = new RunLifecycle(data, runs, run, installation, {
      nodePath: config.nodePath,
      cancellationGraceMs: config.cancellationGraceMs,
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        TMPDIR: run.tempDir,
        TMP: run.tempDir,
        TEMP: run.tempDir,
        ...config.env,
        ...request.env,
      },
    });
    active.set(runId, lifecycle);
    void lifecycle.done.then(
      () => active.delete(runId),
      () => active.delete(runId),
    );
    return { runId };
  }
  return {
    ...data,
    startRun(input) {
      ensureOpen();
      const promise = start(input);
      starting.add(promise);
      void promise.then(
        () => starting.delete(promise),
        () => starting.delete(promise),
      );
      return promise;
    },
    observeRun(runId, options = {}) {
      ensureOpen();
      runs.require(runId);
      const controller = new AbortController();
      const abort = () => controller.abort();
      async function* events() {
        options.signal?.addEventListener("abort", abort, { once: true });
        observing.signal.addEventListener("abort", abort, { once: true });
        if (options.signal?.aborted || observing.signal.aborted) abort();
        let cursor = options.cursor;
        let wake = () => {};
        const unsubscribe = runs.subscribe(runId, () => wake());
        controller.signal.addEventListener("abort", () => wake(), {
          once: true,
        });
        try {
          while (!controller.signal.aborted) {
            const changed = new Promise<void>((resolve) => {
              wake = resolve;
            });
            const page = runs.events(runId, cursor ? { cursor } : {});
            for (const event of page.entries) {
              if (controller.signal.aborted) return;
              cursor = event.cursor;
              yield event;
            }
            if (page.entries.length) continue;
            const run = runs.require(runId);
            if (run.phase === "finished" || run.interruption) return;
            await changed;
          }
        } finally {
          unsubscribe();
          options.signal?.removeEventListener("abort", abort);
          observing.signal.removeEventListener("abort", abort);
        }
      }
      const iterator = events();
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next: () => iterator.next(),
        return: async () => {
          abort();
          return iterator.return();
        },
        throw: async (error) => {
          abort();
          return iterator.throw(error);
        },
      };
    },
    async submitAnswer(id, answer) {
      ensureOpen();
      z.uuid().parse(id);
      for (const [runId, lifecycle] of active) {
        if (runs.require(runId).interactions.some((item) => item.id === id))
          return lifecycle.submitAnswer(id, answer);
      }
      throw new Error(`No active interaction '${id}'`);
    },
    async cancelRun(runId, reason) {
      ensureOpen();
      if (reason !== undefined) z.string().trim().min(1).parse(reason);
      const run = runs.require(runId);
      if (run.phase === "finished") return;
      if (run.interruption) throw new RunInterruptedError(run);
      active.get(runId)?.cancel(reason);
    },
    async waitRun(runId) {
      ensureOpen();
      const run = runs.require(runId);
      if (run.result) return run.result;
      if (run.interruption) throw new RunInterruptedError(run);
      const lifecycle = active.get(runId);
      if (!lifecycle) throw new Error("Run has no active scheduling operation");
      return lifecycle.done;
    },
    async finalizeInterruptedRun(runId, confirmation) {
      ensureOpen();
      z.strictObject({ processesStopped: z.literal(true) }).parse(confirmation);
      const run = runs.require(runId);
      const interruption = run.interruption;
      if (!interruption) throw new Error("Run is not interrupted");
      if (run.result) return run.result;
      let promise = finalizing.get(runId);
      if (!promise) {
        promise = (async () => {
          const installation = await data.getInstallation(run.package);
          if (!installation) throw new Error("Run installation is missing");
          return finalizeRun(data, runs, runId, installation, {
            status: "failed",
            reason: interruption.reason,
          });
        })();
        finalizing.set(runId, promise);
        void promise.then(
          () => finalizing.delete(runId),
          () => finalizing.delete(runId),
        );
      }
      return promise;
    },
    close() {
      closing ??= (async () => {
        await Promise.allSettled(starting);
        for (const lifecycle of active.values())
          lifecycle.cancel("Kernel runtime closed");
        const results = await Promise.allSettled(
          [...active.values()]
            .map((lifecycle) => lifecycle.done)
            .concat([...finalizing.values()]),
        );
        observing.abort();
        try {
          runs.release(owner);
        } finally {
          await data.close();
        }
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      })();
      return closing;
    },
  };
}
