import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmod,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { IntloomError, type ResponseSource } from "@intloom/loom-sdk";
import {
  serve,
  readServicePort,
  kernelVersion,
  npmRoot,
  describeConfiguration,
  type Kernel,
  type ServeOptions,
} from "@intloom/kernel";
import {
  maximumBytes,
  publicError,
  type Endpoint,
  type Request,
  type Reply,
  type ServiceMethods,
} from "./protocol.ts";
import { openMcpHttp } from "../mcp/http.ts";
import { version } from "../metadata.ts";

export async function openService(
  options: ServeOptions & {
    mcpPort?: number;
    nativeResponseSource?: ResponseSource;
    logPath?: string;
  },
) {
  const configuredPort = await readServicePort(options.dataDir);
  let runRevision = 0;
  const recoveryFile = join(options.dataDir, "upgrade-recovery");
  const recoverUpgrade = await readFile(recoveryFile, "utf8").then(
    (value) => value === kernelVersion,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
  const kernel = await serve({
    recoverUpgrade,
    dataDir: options.dataDir,
    ...(options.projectDir ? { projectDir: options.projectDir } : {}),
    ...(options.bindings ? { bindings: options.bindings } : {}),
    onRunEvents(notice) {
      runRevision++;
      options.onRunEvents?.(notice);
    },
  });
  let directory: string | undefined;
  let endpoint: string;
  const descriptor = join(resolve(options.dataDir), "service.json");
  const tokenPath = join(options.dataDir, "token");
  let token: string;
  const connections = new Set<Socket>();
  let stopping = false;
  let stopped: Promise<void> | undefined;
  let http: Awaited<ReturnType<typeof openMcpHttp>> | undefined;
  let finish!: () => void;
  let fail!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  done.catch(() => undefined);
  const npmDirectory = npmRoot(true).catch(() => undefined);
  const methods: Omit<ServiceMethods, "serviceShutdown"> = {
    installLoom: kernel.installLoom,
    getStorageIssues: kernel.getStorageIssues,
    removeLoom: kernel.removeLoom,
    getLoom: kernel.getLoom,
    listLooms: kernel.listLooms,
    getLoomCatalog: kernel.getLoomCatalog,
    getArtifactCatalog: kernel.getArtifactCatalog,
    createRun: kernel.createRun,
    startRun: kernel.startRun,
    resumeRun: kernel.resumeRun,
    listInteractions: kernel.listInteractions,
    getInteraction: kernel.getInteraction,
    respondInteraction: kernel.respondInteraction,
    cancelRun: kernel.cancelRun,
    getRun: kernel.getRun,
    getRunActivity: kernel.getRunActivity,
    getRunResult: kernel.getRunResult,
    listArtifacts: kernel.listArtifacts,
    getArtifact: kernel.getArtifact,
    exportArtifact: kernel.exportArtifact,
    listAcceptances: kernel.listAcceptances,
    getAcceptance: kernel.getAcceptance,
    listRuns: kernel.listRuns,
    listUnfinishedRuns: kernel.listUnfinishedRuns,
    getRunOverview: kernel.getRunOverview,
    listRunEvents: kernel.listRunEvents,
    readArtifact: async (options) => {
      const { data, ...range } = await kernel.readArtifact(options);
      return {
        ...range,
        encoding: "base64",
        data: Buffer.from(data).toString("base64"),
      };
    },
    describeConfiguration: (projectDir) => {
      if (projectDir !== undefined && typeof projectDir !== "string")
        throw new IntloomError(
          "INVALID_ARGUMENT",
          "Expected a project directory.",
        );
      return describeConfiguration(options.dataDir, projectDir);
    },
    serviceStatus: async () => ({
      status: stopping ? "closing" : "ready",
      version,
      kernelVersion,
      activeRunCount: kernel.activeRunCount,
      runRevision,
      npmGlobalRoot: await npmDirectory,
      endpoint,
      logPath:
        options.logPath ?? join(options.dataDir, "logs", "service.jsonl"),
      storageIssues: await kernel.getStorageIssues(),
      mcpUrl: http?.url ?? "",
      tokenPath,
    }),
  };
  const server = createServer((socket) => {
    const observation = new AbortController();
    socket.once("close", () => observation.abort());
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
    socket.on("error", () => undefined);
    let buffer = Buffer.alloc(0);
    let dispatched = false;
    socket.on("data", (chunk: Buffer) => {
      if (dispatched) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > maximumBytes) {
        dispatched = true;
        socket.end(
          `${JSON.stringify({ id: "", ok: false, error: { code: "RESULT_TOO_LARGE", message: "Request exceeds 8 MiB." } })}\n`,
        );
        return;
      }
      const end = buffer.indexOf(10);
      if (end < 0) return;
      dispatched = true;
      void (async () => {
        let id = "";
        let related: Record<string, string> = {};
        let shouldStop = false;
        let reply: Reply;
        try {
          const request = JSON.parse(
            buffer.subarray(0, end).toString("utf8"),
          ) as Request;
          if (request.formatVersion !== 1)
            throw new IntloomError(
              "PROTOCOL_UNSUPPORTED",
              "Unsupported Intloom service protocol.",
            );
          if (
            typeof request.id !== "string" ||
            typeof request.token !== "string" ||
            typeof request.method !== "string" ||
            !Array.isArray(request.params)
          )
            throw new IntloomError(
              "INVALID_ARGUMENT",
              "Invalid Intloom service request.",
            );
          id = request.id;
          const argument = request.params[0];
          if (
            ["getRun", "getRunResult", "getRunActivity"].includes(
              request.method,
            ) &&
            typeof argument === "string"
          )
            related = { runId: argument };
          else if (argument && typeof argument === "object") {
            for (const key of ["runId", "artifactId"] as const) {
              const value = (argument as Record<string, unknown>)[key];
              if (typeof value === "string") related[key] = value;
            }
          }
          const received = Buffer.from(request.token);
          const expected = Buffer.from(token);
          if (
            received.length !== expected.length ||
            !timingSafeEqual(received, expected)
          )
            throw new IntloomError(
              "SERVICE_ACCESS_DENIED",
              "Local service credential is invalid.",
            );
          if (request.method === "serviceShutdown") {
            shouldStop = true;
            await stopExecution();
            reply = { id, ok: true, data: { status: "stopped" } };
          } else {
            const method = Object.hasOwn(methods, request.method)
              ? methods[request.method as keyof typeof methods]
              : undefined;
            if (!method)
              throw new IntloomError(
                "INVALID_ARGUMENT",
                "Unknown service operation.",
              );
            reply = {
              id,
              ok: true,
              data:
                request.method === "listRunEvents"
                  ? await kernel.listRunEvents(
                      request.params[0] as Parameters<
                        Kernel["listRunEvents"]
                      >[0],
                      observation.signal,
                    )
                  : await (method as (...args: unknown[]) => Promise<unknown>)(
                      ...request.params,
                    ),
            };
          }
        } catch (error) {
          reply = { id, ok: false, error: publicError(error) };
        }
        let encoded = JSON.stringify(reply);
        if (Buffer.byteLength(encoded) > maximumBytes)
          encoded = JSON.stringify({
            id,
            ok: false,
            error: {
              code: "RESULT_TOO_LARGE",
              message:
                "Result exceeds 8 MiB; use narrower paginated queries, artifact read ranges, or artifact export. Large outputs should be stored as artifacts.",
              details: { operationId: id, ...related },
            },
          });
        if (!socket.destroyed) socket.end(`${encoded}\n`);
        if (shouldStop) void close().catch(() => undefined);
      })();
    });
  });
  let executionStopped: Promise<void> | undefined;
  function stopExecution() {
    stopping = true;
    executionStopped ??= (async () => {
      try {
        await kernel.shutdown();
      } finally {
        await http?.close();
      }
    })();
    return executionStopped;
  }
  function close(): Promise<void> {
    stopped ??= (async () => {
      try {
        await stopExecution();
      } finally {
        await rm(descriptor, { force: true });
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
          for (const connection of connections) {
            connection.once("finish", () => connection.destroy());
            connection.end();
          }
        });
        if (directory) await rm(directory, { recursive: true, force: true });
      }
    })();
    stopped.then(finish, fail);
    return stopped;
  }
  try {
    if (process.platform === "win32") {
      endpoint = "\\\\.\\pipe\\intloom-" + randomBytes(24).toString("hex");
    } else {
      directory = await mkdtemp(join(tmpdir(), "intloom-ipc-"));
      endpoint = join(directory, "service.sock");
      await chmod(directory, 0o700);
    }
    token = await readFile(tokenPath, "utf8").catch(
      async (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        const value = randomBytes(32).toString("hex");
        await writeFile(tokenPath, value, { mode: 0o600 });
        return value;
      },
    );
    if (directory && Buffer.byteLength(endpoint) > 103)
      throw new IntloomError(
        "PROTOCOL_UNSUPPORTED",
        "This build requires a Unix socket path of at most 103 bytes.",
      );
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(endpoint, () => {
        server.off("error", reject);
        resolve();
      });
    });
    if (directory) await chmod(endpoint, 0o600);
    http = await openMcpHttp({
      dataDir: options.dataDir,
      token,
      port: options.mcpPort ?? configuredPort,
      closing: () => stopping,
      ...(options.nativeResponseSource
        ? { nativeResponseSource: options.nativeResponseSource }
        : {}),
    });
    const preparing = descriptor + ".tmp";
    await writeFile(
      preparing,
      JSON.stringify({
        formatVersion: 1,
        endpoint,
        token,
        pid: process.pid,
        mcpUrl: http.url,
        version,
      } satisfies Endpoint),
      { mode: 0o600 },
    );
    await chmod(preparing, 0o600);
    await rename(preparing, descriptor);
    if (recoverUpgrade) await rm(recoveryFile, { force: true });
    return { close, done, endpoint, kernel, mcpUrl: http.url };
  } catch (error) {
    stopping = true;
    if (server.listening) server.close();
    for (const socket of connections) socket.destroy();
    try {
      await http?.close();
    } finally {
      try {
        if (directory) await rm(directory, { recursive: true, force: true });
      } finally {
        await kernel.close();
      }
    }
    throw error;
  }
}
