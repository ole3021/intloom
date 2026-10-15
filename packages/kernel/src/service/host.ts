import type { LoomInput } from "@intloom/loom-sdk";
import { exists, safePath } from "../mirror/files.ts";
import { createRuntimeObservation } from "../runtime/run-observation.ts";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { basename, join } from "node:path";
import { openLog, withLogger, type LogHandle } from "@intloom/utils";
import { stat } from "node:fs/promises";
import {
  initializeProject,
  run,
  createEffector,
  cancelAllRuns,
  listRuns,
  listLooms,
  loadConfig,
  type ProjectExecution,
  type StorageHandle,
  type RunView,
  type RunSource,
} from "../index.ts";
import { openFileStorage } from "../storage/file/open.ts";
import { openSqliteStorage } from "../storage/sqlite/open.ts";
import {
  localhostHostValidation,
  localhostOriginValidation,
} from "@modelcontextprotocol/node";
import * as z from "zod";
import { errorView, failure } from "./errors.ts";
import { createMcpEndpoint } from "./mcp/server.ts";
import { resolveProjectEntry } from "./application/entry.ts";
import {
  acquireServiceLock,
  projectRoot,
  readConnection,
  writeMetadata,
} from "./discovery.ts";
import {
  serviceUrl,
  type ServiceInfo,
  type ServiceStatus,
} from "./contracts.ts";
import { readExecutionLimits } from "./execution-limits.ts";
import { createServiceApi } from "./http-api.ts";
import { ensureLooms } from "./looms/install.ts";

export interface ProjectHost {
  readonly execution: ProjectExecution;
  readonly storage: StorageHandle;
  readonly info: ServiceInfo;
  assertOpen(): void;
  startRun(
    loomName: string,
    input: LoomInput,
    source: RunSource,
  ): Promise<RunView>;
  presentRun(run: RunView): RunView;
  status(): Promise<ServiceStatus>;
  close(): Promise<void>;
}
export interface StartHostOptions {
  readonly projectRoot: string;
  readonly port?: number;
}

export async function startProjectHost(
  options: StartHostOptions,
  onLogFile?: (filePath: string, logs: LogHandle) => void,
): Promise<ProjectHost> {
  const parsed = z
    .strictObject({
      projectRoot: z.string().min(1),
      port: z.number().int().min(0).max(65535).optional(),
    })
    .parse(options);
  const root = await projectRoot(parsed.projectRoot);
  if (await exists(await safePath(root, ".intloom/restore.lock")))
    throw failure(
      "MIRROR_RESTORE_INCOMPLETE",
      `Incomplete restore detected at ${join(root, ".intloom/restore.lock")}; clean only paths recorded by that attempt before starting.`,
    );
  const instanceId = randomUUID();
  const release = await acquireServiceLock(root, instanceId);
  let storage: StorageHandle | undefined;
  let cleanupServer: (() => Promise<void>) | undefined;
  let execution: ProjectExecution | undefined;
  let logs: LogHandle | undefined;
  let logFailure: Error | undefined;
  const admission = new AbortController();
  try {
    logs = await openLog({
      directory: join(root, ".intloom", "logs"),
      onError(error) {
        logFailure = error;
        admission.abort(error);
        if (execution)
          void cancelAllRuns(execution).catch(() => {
            process.exitCode = 1;
          });
      },
    });
    const log = logs.logger;
    log.info("service_starting", { instanceId });
    if (logFailure) throw logFailure;
    onLogFile?.(logs.filePath, logs);
    const previous = await readConnection(root);
    const config = await loadConfig(root);
    const backend = config.localStorage ?? "file";
    {
      const otherStore = join(
        root,
        "intloom",
        backend === "file" ? "storage.sqlite" : "store.json",
      );
      const existing = await stat(otherStore).catch((cause: unknown) => {
        if (
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "ENOENT"
        )
          return undefined;
        throw cause;
      });
      if (existing)
        throw failure(
          "CLI_STORAGE_CONFLICT",
          "Existing project data uses the other localStorage backend. Restore the original setting; automatic data migration is not supported.",
        );
    }
    await withLogger(log, () => ensureLooms(root, config.looms ?? []));
    const token = previous?.token ?? randomBytes(32).toString("base64url");
    storage = await withLogger(log, async () =>
      backend === "file"
        ? await openFileStorage({
            directory: join(root, "intloom"),
            layout: "directories",
          })
        : await openSqliteStorage({
            filename: join(root, "intloom/storage.sqlite"),
            projectId: "project",
          }),
    );
    log.info("storage_opened", { backend });
    const openedStorage = storage;
    const limits = await readExecutionLimits(root);
    const observation = createRuntimeObservation({
      serviceInstanceId: instanceId,
      ...(limits.run ? { limits: limits.run } : {}),
      ...(limits.prices ? { prices: limits.prices } : {}),
    });
    log.info("execution_limits_loaded", {
      maxAgentSteps: limits.maxAgentSteps,
      ...(limits.run ?? {}),
    });
    execution = await withLogger(log, () =>
      initializeProject(root, {
        runtimeDirectory: join(root, ".intloom", "runtime"),
        storage: openedStorage.access,
        storageHandle: openedStorage,
        effector: createEffector({
          maxAgentSteps: limits.maxAgentSteps,
          serviceModelObserver: observation.observer,
        }),
        observation,
        signal: admission.signal,
        logger: log,
      }),
    );
    if (logFailure) throw logFailure;
    const ownedStorage = storage;
    const ownedExecution = execution;
    let closing: Promise<void> | undefined;
    let host!: ProjectHost;
    const endpoint = createMcpEndpointProxy(() => host);
    const api = createServiceApi(() => host);
    const validateHost = localhostHostValidation();
    const validateOrigin = localhostOriginValidation();
    const server = createServer((req, res) => {
      const suppliedId = req.headers["x-intloom-request-id"];
      const requestId =
        typeof suppliedId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/u.test(suppliedId)
          ? suppliedId
          : randomUUID();
      req.headers["x-intloom-request-id"] = requestId;
      void withLogger(log.child({ requestId }), () => handle(req, res)).catch(
        (error: unknown) => {
          log.warn("request_failed", { requestId, err: error });
          if (!res.headersSent)
            res.writeHead(400, { "content-type": "application/json" });
          if (!res.writableEnded)
            res.end(
              JSON.stringify(
                req.url?.startsWith("/api/")
                  ? {
                      ok: false,
                      error: errorView(error),
                      outcome: "not_applied",
                      meta: {
                        requestId,
                        projectRoot: root,
                        serviceInstanceId: instanceId,
                      },
                    }
                  : { error: errorView(error) },
              ),
            );
        },
      );
    });
    async function handle(req: IncomingMessage, res: ServerResponse) {
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      const supplied = Buffer.from(req.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        res.writeHead(401).end();
        return;
      }
      const boundInstance = req.headers["x-intloom-service-instance"];
      if (
        !req.url?.startsWith("/api/") &&
        boundInstance !== undefined &&
        boundInstance !== instanceId
      ) {
        res.writeHead(409, { "content-type": "application/json" }).end(
          JSON.stringify({
            error: {
              code: "SERVICE_INSTANCE_CHANGED",
              message: "The requested Service instance changed.",
              retryable: false,
            },
          }),
        );
        return;
      }
      if (closing) {
        res.writeHead(503).end();
        return;
      }
      if (logFailure && req.url !== "/_stop" && req.url !== "/_status") {
        res
          .writeHead(503, { "content-type": "application/json" })
          .end(JSON.stringify({ error: errorView(logFailure) }));
        return;
      }
      if (req.url === "/_status" && req.method === "GET") {
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(await host.status()));
        return;
      }
      const body = req.method === "POST" ? await readBody(req) : undefined;
      if (await api.handle(req, res, body)) return;
      if (req.url === "/_stop" && req.method === "POST") {
        const request = z.strictObject({ instanceId: z.string() }).parse(body);
        if (request.instanceId !== instanceId) {
          res.writeHead(409).end();
          return;
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ stopping: true }));
        setImmediate(() => {
          void host.close().catch(() => {
            process.exitCode = 1;
          });
        });
        return;
      }
      if (!resolveProjectEntry(req.url ?? "/")) {
        res.writeHead(404).end();
        return;
      }
      await endpoint.handle(req, res, body);
    }
    cleanupServer = async () => {
      try {
        await endpoint.close();
      } finally {
        await new Promise<void>((resolveClose) => {
          if (!server.listening) {
            resolveClose();
            return;
          }
          server.close(() => resolveClose());
          server.closeAllConnections();
        });
      }
    };
    await new Promise<void>((resolveListen, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(parsed.port ?? previous?.port ?? 0, "127.0.0.1", () => {
        server.off("error", rejectListen);
        resolveListen();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw failure(
        "CLI_SERVICE_UNAVAILABLE",
        "The service did not bind a local port.",
      );
    const connection = {
      version: 1 as const,
      projectRoot: root,
      port: address.port,
      token,
      storage: backend,
    };
    const info: ServiceInfo = {
      version: 1,
      projectRoot: root,
      pid: process.pid,
      instanceId,
      url: serviceUrl(connection),
      startedAt: new Date().toISOString(),
      storage: backend,
      logFile: basename(logs.filePath),
    };
    const closeServer = cleanupServer;
    host = Object.freeze({
      execution: ownedExecution,
      storage: ownedStorage,
      info,
      assertOpen() {
        if (logFailure) throw logFailure;
        if (closing)
          throw failure(
            "CLI_SERVICE_CLOSING",
            "The project service is closing.",
          );
      },
      async startRun(loomName: string, input: LoomInput, source: RunSource) {
        host.assertOpen();
        const blueprint = Object.hasOwn(
          ownedExecution.registries.blueprints,
          loomName,
        )
          ? ownedExecution.registries.blueprints[loomName]
          : undefined;
        if (typeof loomName !== "string" || !loomName.trim() || !blueprint)
          return run(ownedExecution, loomName, input, source);
        return ownedExecution.runtime.startRun(blueprint, input, source);
      },
      presentRun: (run: RunView) => run,
      async status() {
        const [allRuns, allLooms] = await Promise.all([
          listRuns(ownedExecution),
          listLooms(ownedExecution),
        ]);
        return {
          ...info,
          execution: ownedExecution.executionStatus(),
          ...(logFailure ? { logError: errorView(logFailure) } : {}),
          loomCount: allLooms.length,
          availableLoomCount: allLooms.filter((loom) => loom.isAvailable)
            .length,
          runningRuns: allRuns.filter((item) => item.status === "running")
            .length,
          waitingRuns: allRuns.filter((item) => item.status === "waiting")
            .length,
          pausedRuns: allRuns.filter((item) => item.status === "paused").length,
          completedRuns: allRuns.filter((item) => item.status === "completed")
            .length,
          failedRuns: allRuns.filter((item) => item.status === "failed").length,
        };
      },
      close() {
        closing ??= (async () => {
          api.closing();
          admission.abort(
            failure("CLI_SERVICE_CLOSING", "The project service is closing."),
          );
          log.info("service_stopping");

          let closeError: unknown;
          await cleanup([
            () => ownedExecution.runtime.suspend(),
            closeServer,
            () => ownedStorage.dispose(),
          ]).catch((cause: unknown) => {
            closeError = cause;
          });
          if (closeError) log.error("service_stop_failed", { err: closeError });
          else log.info("service_stopped");
          await logs?.close().catch((cause: unknown) => {
            closeError ??= cause;
          });
          await release().catch((cause: unknown) => {
            closeError ??= cause;
          });
          if (closeError) throw closeError;
        })();
        return closing;
      },
    });
    await writeMetadata(root, "connection.json", connection);
    await writeMetadata(root, "service.json", info);
    log.info("service_ready", { port: address.port });
    if (logFailure) throw logFailure;
    return host;
  } catch (cause) {
    admission.abort(cause);
    logs?.logger.error("service_start_failed", { err: cause });
    await cleanup([
      () => (execution ? execution.runtime.suspend() : Promise.resolve()),
      () => cleanupServer?.() ?? Promise.resolve(),
      () => storage?.dispose() ?? Promise.resolve(),
      () => logs?.close() ?? Promise.resolve(),
      release,
    ]).catch(() => undefined);
    throw cause;
  }
}

/** Attempts every cleanup step and retains the first cleanup error; initialization callers preserve the original failure. */
async function cleanup(steps: readonly (() => Promise<void>)[]) {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw errors[0];
}

function createMcpEndpointProxy(getHost: () => ProjectHost) {
  let endpoint: ReturnType<typeof createMcpEndpoint> | undefined;
  return {
    handle(req: IncomingMessage, res: ServerResponse, body?: unknown) {
      endpoint ??= createMcpEndpoint(getHost());
      return endpoint.handle(req, res, body);
    },
    async close() {
      await endpoint?.close();
    },
  };
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 4 * 1024 * 1024)
      throw failure("INVALID_REQUEST", "The request body exceeds 4 MiB.");
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (cause) {
    throw failure(
      "INVALID_REQUEST",
      "The request body is not valid JSON.",
      cause,
    );
  }
}
