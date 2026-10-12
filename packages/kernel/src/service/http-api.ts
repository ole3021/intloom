import {
  agentRefSchema,
  agentClaimSchema,
  agentToolSchema,
  agentAssetSchema,
  agentCompleteSchema,
  agentFailureSchema,
} from "./agent-contracts.ts";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as z from "zod";
import type { RunSource } from "../runtime/execution-policy.ts";
import type { RunView } from "../runtime/run-view.ts";
import type { ProjectHost } from "./host.ts";
import { createProjectApplication } from "./application/project.ts";
import {
  parseArtifactQuery,
  parseArtifactSelector,
} from "./application/artifacts.ts";
import { errorView, failure } from "./errors.ts";
import {
  flowRequestSchema,
  answerRequestSchema,
  type Admission,
  type CoreMeta,
  type OperationReceipt,
  type ServiceRunView,
} from "./api-contracts.ts";

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

/** JSON/SSE and MCP borrow the same resource owner. Only current-instance metadata is retained here. */
export function createServiceApi(getHost: () => ProjectHost) {
  const operations = new Map<
    string,
    { identity: string; receipt: OperationReceipt }
  >();
  const observers = new Set<() => void>();
  let shuttingDown = false;
  function snapshot(run: RunView): ServiceRunView {
    if (run.serviceInstanceId !== getHost().info.instanceId || !run.revision)
      throw failure(
        "RUN_METADATA_UNAVAILABLE",
        "Run metadata does not belong to the current Service instance.",
      );
    return run as ServiceRunView;
  }
  async function serviceInfo() {
    return {
      ...(await getHost().status()),
      apiVersion: 1 as const,
      capabilities: [
        "query",
        "observe",
        "flow",
        "answer",
        "cancel",
        "operation_receipts",
        "run_metrics",
        "execution_limits",
        "commit_references",
      ],
    };
  }
  function statusCode(code: string) {
    if (code === "NOT_FOUND") return 404;
    if (
      [
        "CONFLICT",
        "BUSY",
        "OPERATION_CONFLICT",
        "SERVICE_INSTANCE_CHANGED",
      ].includes(code)
    )
      return 409;
    if (code.includes("CLOSING") || code === "KERNEL_UNAVAILABLE") return 503;
    return code === "CLI_INTERNAL_ERROR" ? 500 : 400;
  }
  function write(
    res: ServerResponse,
    data: unknown,
    meta: CoreMeta,
    status = 200,
  ) {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: true, data, meta }));
  }
  async function admit(
    kind: "flow" | "answer",
    source: RunSource,
    input:
      | ReturnType<typeof flowRequestSchema.parse>
      | ReturnType<typeof answerRequestSchema.parse>,
    runId?: string,
  ): Promise<Admission> {
    const host = getHost();
    const operationId = input.operationId;
    const identity = canonical({ kind, source, input, runId });
    const known = operations.get(operationId);
    const application = createProjectApplication(host, source);
    if (known) {
      if (known.identity !== identity)
        throw failure(
          "OPERATION_CONFLICT",
          "The operation ID is already bound to different parameters.",
        );
      return {
        receipt: known.receipt,
        ...(known.receipt.status === "accepted"
          ? { run: snapshot(await application.getRun(known.receipt.runId)) }
          : {}),
      };
    }
    const base = { serviceInstanceId: host.info.instanceId, operationId, kind };
    const operation = {
      identity,
      receipt: { ...base, status: "pending" } as OperationReceipt,
    };
    operations.set(operationId, operation);
    try {
      const run =
        kind === "flow" && "flowName" in input
          ? await application.flow(input.flowName, input.intent)
          : "actionId" in input && runId
            ? await application.answerAsk(runId, input.actionId, input.answer)
            : (() => {
                throw failure("INVALID_REQUEST", "Invalid admission input.");
              })();
      const view = snapshot(run);
      operation.receipt = {
        ...base,
        status: "accepted",
        runId: run.runId,
        acceptedAt: new Date().toISOString(),
        acceptedRevision: view.revision,
      };
      return { receipt: operation.receipt, run: view };
    } catch (error) {
      operation.receipt = {
        ...base,
        status: "rejected",
        error: errorView(error),
      };
      return { receipt: operation.receipt };
    }
  }

  async function observe(
    res: ServerResponse,
    source: RunSource,
    meta: CoreMeta,
    runId?: string,
  ) {
    const application = createProjectApplication(getHost(), source);
    // Validate the target before committing SSE headers.
    if (runId) await application.getRun(runId);
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    res.flushHeaders();
    let closed = false;
    let busy = false;
    let initial = true;
    const seen = new Map<string, number>();
    const queue = new Map<string, unknown>();
    let blocked = false;
    let lastService = "";
    function send(key: string, event: unknown) {
      if (closed) return;
      queue.set(key, { ok: true, data: event, meta });
      drain();
    }
    function drain() {
      if (blocked || closed) return;
      for (const [key, event] of queue) {
        queue.delete(key);
        if (!res.write(`data: ${JSON.stringify(event)}\n\n`)) {
          blocked = true;
          break;
        }
      }
    }
    const onDrain = () => {
      blocked = false;
      drain();
    };
    res.on("drain", onDrain);
    const closing = () => {
      send("closing", {
        type: "service_closing",
        serviceInstanceId: getHost().info.instanceId,
      });
      // Latest queued frames precede closing even when the client is currently backpressured.
      for (const event of queue.values())
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      queue.clear();
      res.end();
      cleanup();
    };
    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      clearInterval(heartbeat);
      observers.delete(closing);
      res.off("drain", onDrain);
    }
    // Register ownership before reading the initial full state. Per-client polling is serialized.
    observers.add(closing);
    const timer = setInterval(() => {
      void poll();
    }, 100);
    const heartbeat = setInterval(() => {
      if (!blocked && !closed) res.write(": keepalive\n\n");
    }, 15000);
    res.once("close", cleanup);
    async function poll() {
      if (busy || closed || shuttingDown) return;
      busy = true;
      try {
        const runs = runId
          ? [await getHost().execution.runtime.getRun(runId)]
          : await getHost().execution.runtime.listRuns();
        const views = runs.map((run) => snapshot(getHost().presentRun(run)));
        if (initial && !runId) {
          const service = await serviceInfo();
          send("project", {
            type: "project_snapshot",
            serviceInstanceId: getHost().info.instanceId,
            service,
            workflows: await application.listWorkflows(),
            runs: views,
          });
          lastService = canonical(service);
          for (const run of views) seen.set(run.runId, run.revision);
        } else {
          for (const run of views)
            if (seen.get(run.runId) !== run.revision) {
              send(run.runId, {
                type: "run_snapshot",
                serviceInstanceId: getHost().info.instanceId,
                run,
              });
              seen.set(run.runId, run.revision);
            }
          if (!runId) {
            const service = await serviceInfo();
            const value = canonical(service);
            if (value !== lastService) {
              send("service", {
                type: "service_snapshot",
                serviceInstanceId: getHost().info.instanceId,
                service,
              });
              lastService = value;
            }
          }
        }
        initial = false;
      } catch (error) {
        if (!closed) {
          res.write(
            `data: ${JSON.stringify({ ok: false, error: errorView(error), outcome: "not_applied", meta })}\n\n`,
          );
          res.end();
          cleanup();
        }
      } finally {
        busy = false;
      }
    }
    await poll();
  }

  return {
    closing() {
      shuttingDown = true;
      for (const close of [...observers]) close();
    },
    async handle(
      req: IncomingMessage,
      res: ServerResponse,
      body: unknown,
    ): Promise<boolean> {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/api/")) return false;
      const host = getHost();
      const meta: CoreMeta = {
        requestId: String(req.headers["x-intloom-request-id"] ?? randomUUID()),
        projectRoot: host.info.projectRoot,
        serviceInstanceId: host.info.instanceId,
      };
      try {
        if (shuttingDown)
          throw failure(
            "CLI_SERVICE_CLOSING",
            "The project service is closing.",
          );
        const expected = req.headers["x-intloom-service-instance"];
        if (expected !== host.info.instanceId)
          throw failure(
            "SERVICE_INSTANCE_CHANGED",
            "The request is not bound to this Service instance.",
          );
        if (url.pathname === "/api/v1/service" && req.method === "GET") {
          write(res, await serviceInfo(), meta);
          return true;
        }
        if (url.pathname === "/api/v1/service/stop" && req.method === "POST") {
          z.strictObject({}).parse(body);
          write(res, { stopping: true }, meta, 202);
          setImmediate(() => {
            void host.close().catch(() => {
              process.exitCode = 1;
            });
          });
          return true;
        }
        const match = /^\/api\/v1\/(cli|studio|agent)(\/.*)?$/u.exec(
          url.pathname,
        );
        if (!match)
          throw failure(
            "NOT_FOUND",
            "The Service API endpoint does not exist.",
          );
        const source: RunSource =
          match[1] === "agent"
            ? "agent_ide"
            : match[1] === "studio"
              ? "studio"
              : "cli";
        const path = match[2] ?? "/";
        const app = createProjectApplication(host, source);
        const method = req.method;
        if (method === "GET" && path === "/events") {
          await observe(res, source, meta);
          return true;
        }
        const runMatch =
          /^\/runs\/([^/]+)(?:\/(answers|cancel|events))?$/u.exec(path);
        if (runMatch?.[1]) {
          const runId = decodeURIComponent(runMatch[1]);
          meta.runId = runId;
          if (method === "GET" && runMatch[2] === "events") {
            await observe(res, source, meta, runId);
            return true;
          }
          if (method === "GET" && !runMatch[2]) {
            write(res, snapshot(await app.getRun(runId)), meta);
            return true;
          }
          if (method === "POST" && runMatch[2] === "cancel") {
            z.strictObject({}).parse(body);
            write(res, snapshot(await app.cancelRun(runId)), meta);
            return true;
          }
          if (method === "POST" && runMatch[2] === "answers") {
            const input = answerRequestSchema.parse(body);
            meta.operationId = input.operationId;
            const data = await admit("answer", source, input, runId);
            if (data.receipt.status === "rejected") {
              res
                .writeHead(statusCode(data.receipt.error.code), {
                  "content-type": "application/json",
                })
                .end(
                  JSON.stringify({
                    ok: false,
                    error: data.receipt.error,
                    outcome: "not_applied",
                    data,
                    meta,
                  }),
                );
            } else write(res, data, meta, 202);
            return true;
          }
        }
        if (method === "POST" && path === "/runs") {
          const input = flowRequestSchema.parse(body);
          meta.operationId = input.operationId;
          const data = await admit("flow", source, input);
          if (data.receipt.status === "accepted")
            meta.runId = data.receipt.runId;
          if (data.receipt.status === "rejected")
            res
              .writeHead(statusCode(data.receipt.error.code), {
                "content-type": "application/json",
              })
              .end(
                JSON.stringify({
                  ok: false,
                  error: data.receipt.error,
                  outcome: "not_applied",
                  data,
                  meta,
                }),
              );
          else write(res, data, meta, 202);
          return true;
        }
        if (method === "GET" && path === "/runs") {
          write(
            res,
            (
              await app.listRuns(url.searchParams.get("flowName") ?? undefined)
            ).map(snapshot),
            meta,
          );
          return true;
        }
        if (method === "GET" && path === "/workflows") {
          write(res, await app.listWorkflows(), meta);
          return true;
        }
        const operationMatch = /^\/operations\/([^/]+)$/u.exec(path);
        if (method === "GET" && operationMatch?.[1]) {
          const id = z.uuid().parse(decodeURIComponent(operationMatch[1]));
          meta.operationId = id;
          write(res, operations.get(id)?.receipt ?? null, meta);
          return true;
        }
        const agentMatch =
          /^\/agent-calls\/(get|claim|tool|asset|complete|fail)$/u.exec(path);
        if (method === "POST" && agentMatch && source === "agent_ide") {
          let data: unknown;
          switch (agentMatch[1]) {
            case "get":
              data = await app.getAgentCall(agentRefSchema.parse(body));
              break;
            case "claim":
              data = await app.claimAgentCall(agentClaimSchema.parse(body));
              break;
            case "tool":
              data = await app.callAgentTool(agentToolSchema.parse(body));
              break;
            case "asset":
              data = await app.readAgentAsset(agentAssetSchema.parse(body));
              break;
            case "complete":
              data = snapshot(
                await app.completeAgentCall(agentCompleteSchema.parse(body)),
              );
              break;
            case "fail":
              data = snapshot(
                await app.failAgentCall(agentFailureSchema.parse(body)),
              );
              break;
          }
          write(res, data, meta);
          return true;
        }
        const query: Record<string, unknown> = Object.fromEntries(
          url.searchParams.entries(),
        );
        if (method === "GET" && path === "/artifacts") {
          if (query.limit !== undefined) query.limit = Number(query.limit);
          write(res, await app.listArtifacts(parseArtifactQuery(query)), meta);
          return true;
        }
        if (method === "GET" && path === "/artifact") {
          write(res, await app.getArtifact(parseArtifactSelector(query)), meta);
          return true;
        }
        if (method === "GET" && path === "/records") {
          if (query.limit !== undefined) query.limit = Number(query.limit);
          write(
            res,
            await host.storage.access.listRecords(parseArtifactQuery(query)),
            meta,
          );
          return true;
        }
        const artifactMatch = /^\/artifacts\/([^/]+)$/u.exec(path);
        if (method === "GET" && artifactMatch?.[1]) {
          write(
            res,
            await app.getArtifact(
              parseArtifactSelector({
                artifactId: decodeURIComponent(artifactMatch[1]),
              }),
            ),
            meta,
          );
          return true;
        }
        const recordMatch = /^\/records\/([^/]+)$/u.exec(path);
        if (method === "GET" && recordMatch?.[1]) {
          write(
            res,
            await app.getRecord(decodeURIComponent(recordMatch[1])),
            meta,
          );
          return true;
        }
        throw failure("NOT_FOUND", "The Service API endpoint does not exist.");
      } catch (error) {
        if (!res.headersSent)
          res
            .writeHead(statusCode(errorView(error).code), {
              "content-type": "application/json",
            })
            .end(
              JSON.stringify({
                ok: false,
                error: errorView(error),
                outcome: "not_applied",
                meta,
              }),
            );
        else if (!res.writableEnded) res.end();
        return true;
      }
    },
  };
}
