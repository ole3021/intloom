import { randomUUID } from "node:crypto";
import * as z from "zod";
import {
  projectRoot,
  readConnection,
  serviceStatus,
  startService,
  stopService,
  coreResultSchema,
  serviceRunViewSchema,
  serviceApiInfoSchema,
  projectEventSchema,
  admissionSchema,
  operationReceiptSchema,
  workflowViewSchema,
  type CoreResult,
  type CoreMeta,
  type ServiceRunView,
  type ProjectEvent,
} from "@intloom/kernel/service";
import { scaffoldProject } from "./project-init.ts";
import { doctorProject } from "./doctor.ts";
import { readProjectConfig, updateProjectConfig } from "./configuration.ts";
import {
  planMcpConfig,
  applyMcpConfig,
  type McpConfigInput,
} from "./mcp-config.ts";
import { readLogs, watchLogs } from "./logs.ts";
import {
  addWorkflow,
  removeWorkflow,
  listInstalledWorkflows,
} from "./workflow-packages.ts";
import {
  diagnoseProject,
  recoverProject,
} from "@intloom/kernel/service/recovery";
import { errorView, failure } from "../errors.ts";
import {
  artifactPageSchema,
  storedArtifactSchema,
  type ArtifactQuery,
} from "@intloom/kernel/service/application/artifacts";
import {
  agentCallViewSchema,
  agentClaimResultSchema,
  agentAssetResultSchema,
} from "@intloom/kernel/service/agent-contracts";
import type {
  AgentCallRef,
  AgentCallClaim,
  AgentToolCall,
  AgentAssetRequest,
  AgentCallCompletion,
  AgentCallFailure,
} from "@intloom/kernel";
import {
  storedRecordSchema,
  recordPageSchema,
} from "@intloom/kernel/service/application/records";

export type {
  CoreResult,
  CoreMeta,
  ServiceRunView,
  ProjectEvent,
} from "@intloom/kernel/service";
export interface ProjectInput {
  readonly projectPath: string;
  readonly serviceInstanceId?: string;
}
export interface RunInput extends ProjectInput {
  readonly runId: string;
}
export interface FlowInput extends ProjectInput {
  readonly serviceInstanceId: string;
  readonly operationId: string;
  readonly flowName: string;
  readonly intent: string;
}
export interface AnswerInput extends RunInput {
  readonly serviceInstanceId: string;
  readonly operationId: string;
  readonly actionId: string;
  readonly answer: import("@intloom/kernel").ReadonlyJsonValue;
}
export interface ObserveOptions {
  readonly signal?: AbortSignal;
}
export interface WaitRunInput extends RunInput {
  readonly until?: "action_or_terminal" | "terminal";
  readonly timeoutMs?: number;
}
export interface WaitRunResult {
  readonly run: ServiceRunView;
  readonly reason?: "human_action" | "agent_action" | "terminal";
}

const projectInputSchema = z.object({
  projectPath: z.string().min(1),
  serviceInstanceId: z.uuid().optional(),
});

/** Client operations return JSON; no terminal output, renderer, SDK connection, or execution state escapes. */
export function createCliCore() {
  async function local<T>(
    input: ProjectInput,
    action: (meta: CoreMeta & { projectRoot: string }) => Promise<T>,
  ): Promise<CoreResult<T>> {
    const meta: CoreMeta = {
      requestId: randomUUID(),
      ...(input?.serviceInstanceId
        ? { serviceInstanceId: input.serviceInstanceId }
        : {}),
    };
    try {
      projectInputSchema.parse(input);
      const resolvedMeta = Object.assign(meta, {
        projectRoot: await projectRoot(input.projectPath),
      });
      return { ok: true, data: await action(resolvedMeta), meta };
    } catch (error) {
      return {
        ok: false,
        error: errorView(error),
        outcome: "not_applied",
        meta,
      };
    }
  }
  async function connection(input: ProjectInput, meta: CoreMeta) {
    projectInputSchema.parse(input);
    meta.projectRoot = await projectRoot(input.projectPath);
    const status = await serviceStatus(meta.projectRoot);
    if (
      input.serviceInstanceId &&
      status.instanceId !== input.serviceInstanceId
    )
      throw failure(
        "SERVICE_INSTANCE_CHANGED",
        "The requested Service instance is no longer current.",
      );
    meta.serviceInstanceId = status.instanceId;
    const saved = await readConnection(meta.projectRoot);
    if (!saved || saved.projectRoot !== meta.projectRoot)
      throw failure(
        "CLI_SERVICE_METADATA_INVALID",
        "The project connection changed.",
      );
    return {
      url: `http://127.0.0.1:${saved.port}`,
      headers: {
        authorization: `Bearer ${saved.token}`,
        "x-intloom-request-id": meta.requestId,
        "x-intloom-service-instance": status.instanceId,
      },
    };
  }
  async function request<T>(
    input: ProjectInput,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<CoreResult<T>> {
    const meta: CoreMeta = {
      requestId: randomUUID(),
      ...(input?.serviceInstanceId
        ? { serviceInstanceId: input.serviceInstanceId }
        : {}),
      ...(input && "runId" in input ? { runId: String(input.runId) } : {}),
      ...(input && "operationId" in input
        ? { operationId: String(input.operationId) }
        : {}),
    };
    let sent = false;
    try {
      const trusted = await connection(input, meta);
      sent = true;
      const response = await fetch(new URL(path, trusted.url), {
        method: body === undefined ? "GET" : "POST",
        headers: { ...trusted.headers, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      const result = coreResultSchema(schema).parse(await response.json());
      if (
        result.meta.serviceInstanceId !== meta.serviceInstanceId ||
        result.meta.projectRoot !== meta.projectRoot ||
        result.meta.requestId !== meta.requestId
      )
        throw failure(
          "CLI_RESULT_INVALID",
          "The response does not match the requested project and instance.",
        );
      return result as CoreResult<T>;
    } catch (error) {
      const unknown = body !== undefined && sent;
      return {
        ok: false,
        error: unknown
          ? {
              code: "REQUEST_OUTCOME_UNKNOWN",
              message:
                "No valid operation result was received. Query the original operation before another submission.",
              retryable: false,
            }
          : errorView(error),
        outcome: unknown ? "unknown" : "not_applied",
        meta,
      };
    }
  }
  async function* observe(
    input: ProjectInput,
    path: string,
    options: ObserveOptions = {},
  ): AsyncIterable<CoreResult<ProjectEvent>> {
    const meta: CoreMeta = {
      requestId: randomUUID(),
      ...(input.serviceInstanceId
        ? { serviceInstanceId: input.serviceInstanceId }
        : {}),
    };
    for (let attempt = 0; attempt < 4 && !options.signal?.aborted; attempt++) {
      const controller = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const trusted = await connection(
          {
            ...input,
            ...(meta.serviceInstanceId
              ? { serviceInstanceId: meta.serviceInstanceId }
              : {}),
          },
          meta,
        );
        if (options.signal?.aborted) return;
        timer = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(new URL(path, trusted.url), {
          headers: trusted.headers,
          redirect: "error",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (
          !response.ok ||
          !response.body ||
          !response.headers.get("content-type")?.startsWith("text/event-stream")
        ) {
          if (
            response.headers.get("content-type")?.startsWith("application/json")
          ) {
            const failureResult = coreResultSchema(projectEventSchema).parse(
              await response.json(),
            );
            if (!failureResult.ok) {
              yield failureResult;
              return;
            }
          }
          throw failure(
            "CLI_SERVICE_UNAVAILABLE",
            "The Service did not accept observation.",
          );
        }
        const decoder = new TextDecoder();
        let buffer = "";
        for await (const chunk of response.body) {
          buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(
            /\r\n/gu,
            "\n",
          );
          for (;;) {
            const end = buffer.indexOf("\n\n");
            if (end < 0) break;
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const data = block
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            const result = coreResultSchema(projectEventSchema).parse(
              JSON.parse(data),
            );
            if (result.meta.serviceInstanceId !== meta.serviceInstanceId)
              throw failure(
                "SERVICE_INSTANCE_CHANGED",
                "The observation instance changed.",
              );
            yield result;
            if (!result.ok || result.data.type === "service_closing") return;
          }
          if (buffer.length > 8 * 1024 * 1024)
            throw failure(
              "CLI_RESULT_INVALID",
              "An observation frame exceeded its limit.",
            );
        }
        throw failure(
          "CLI_SERVICE_UNAVAILABLE",
          "The observation connection ended.",
        );
      } catch (error) {
        if (options.signal?.aborted) return;
        const safe = errorView(error);
        if (
          attempt === 3 ||
          safe.code === "SERVICE_INSTANCE_CHANGED" ||
          safe.code === "INVALID_REQUEST"
        ) {
          yield { ok: false, error: safe, outcome: "not_applied", meta };
          return;
        }
      } finally {
        clearTimeout(timer);
        controller.abort();
        options.signal?.removeEventListener("abort", abort);
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(retryTimer);
          options.signal?.removeEventListener("abort", done);
          resolve();
        };
        const retryTimer = setTimeout(done, 100 * 2 ** attempt);
        options.signal?.addEventListener("abort", done, { once: true });
        if (options.signal?.aborted) done();
      });
    }
  }
  const core = {
    initProject: scaffoldProject,
    inspectProject(input: ProjectInput) {
      return local(input, (meta) => diagnoseProject(meta.projectRoot));
    },
    readProjectConfig(input: ProjectInput) {
      return local(input, (meta) => readProjectConfig(meta.projectRoot));
    },
    updateProjectConfig(
      input: ProjectInput & { configuration: string; revision: string },
    ) {
      return local(input, (meta) =>
        updateProjectConfig(
          meta.projectRoot,
          input.configuration,
          input.revision,
        ),
      );
    },
    listWorkflowPackages(input: ProjectInput) {
      return local(input, (meta) => listInstalledWorkflows(meta.projectRoot));
    },
    addWorkflowPackage(input: ProjectInput & { source: string }) {
      return local(input, (meta) =>
        addWorkflow(meta.projectRoot, input.source),
      );
    },
    removeWorkflowPackage(input: ProjectInput & { packageName: string }) {
      return local(input, (meta) =>
        removeWorkflow(meta.projectRoot, input.packageName),
      );
    },
    doctor(
      input: ProjectInput & { execution?: "cli" | "studio" | "agent_ide" },
    ) {
      return local(input, (meta) =>
        doctorProject(meta.projectRoot, input.execution),
      );
    },
    recoverProject(input: ProjectInput & { dryRun?: boolean }) {
      return local(input, (meta) =>
        recoverProject(meta.projectRoot, input.dryRun ?? false),
      );
    },
    planMcpConfig(input: McpConfigInput) {
      return local(input, () => planMcpConfig(input));
    },
    applyMcpConfig(input: McpConfigInput & { beforeHash: string }) {
      return local(input, () => applyMcpConfig(input));
    },
    readLogs,
    watchLogs,
    async getServiceStatus(input: ProjectInput) {
      return local(input, async (meta) => {
        const diagnosis = await diagnoseProject(meta.projectRoot);
        if (diagnosis.status === "running" && diagnosis.service) {
          meta.serviceInstanceId = diagnosis.service.instanceId;
          const info = await request(
            input,
            "/api/v1/service",
            serviceApiInfoSchema,
          );
          if (!info.ok) throw failure(info.error.code, info.error.message);
          return {
            status: "running" as const,
            projectRoot: meta.projectRoot,
            service: info.data,
          };
        }
        return diagnosis.status === "offline"
          ? { status: "stopped" as const, projectRoot: meta.projectRoot }
          : {
              status: "unavailable" as const,
              projectRoot: meta.projectRoot,
              diagnostic: {
                code: "CLI_SERVICE_UNAVAILABLE",
                message: diagnosis.message,
                retryable: false,
              },
            };
      });
    },
    startService(input: ProjectInput & { readonly port?: number }) {
      return local(input, async (meta) => {
        const result = await startService({
          projectRoot: meta.projectRoot,
          ...(input.port === undefined ? {} : { port: input.port }),
        });
        meta.serviceInstanceId = result.service.instanceId;
        return result;
      });
    },
    stopService(input: ProjectInput) {
      return local(input, (meta) =>
        stopService(meta.projectRoot, input.serviceInstanceId),
      );
    },
    flow(input: FlowInput) {
      return request(input, "/api/v1/cli/runs", admissionSchema, {
        operationId: input.operationId,
        flowName: input.flowName,
        intent: input.intent,
      });
    },
    answerAsk(input: AnswerInput) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/answers`,
        admissionSchema,
        {
          operationId: input.operationId,
          actionId: input.actionId,
          answer: input.answer,
        },
      );
    },
    cancelRun(input: RunInput) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/cancel`,
        serviceRunViewSchema,
        {},
      );
    },
    getRun(input: RunInput) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}`,
        serviceRunViewSchema,
      );
    },
    listRuns(input: ProjectInput & { readonly flowName?: string }) {
      return request(
        input,
        `/api/v1/cli/runs${input.flowName ? `?flowName=${encodeURIComponent(input.flowName)}` : ""}`,
        z.array(serviceRunViewSchema),
      );
    },
    listWorkflows(input: ProjectInput) {
      return request(
        input,
        "/api/v1/cli/workflows",
        z.array(workflowViewSchema),
      );
    },
    getOperation(input: ProjectInput & { readonly operationId: string }) {
      return request(
        input,
        `/api/v1/cli/operations/${encodeURIComponent(input.operationId)}`,
        operationReceiptSchema.nullable(),
      );
    },
    getArtifact(
      input: ProjectInput &
        (
          | {
              readonly artifactId: string;
              readonly flowName?: never;
              readonly stageName?: never;
            }
          | {
              readonly artifactId?: never;
              readonly flowName: string;
              readonly stageName: string;
            }
        ),
    ) {
      const selector =
        input.artifactId !== undefined
          ? { artifactId: input.artifactId }
          : { flowName: input.flowName, stageName: input.stageName };
      return request(
        input,
        `/api/v1/cli/artifact?${new URLSearchParams(selector)}`,
        storedArtifactSchema.nullable(),
      );
    },
    listArtifacts(input: ProjectInput & { readonly query?: ArtifactQuery }) {
      const query = new URLSearchParams(
        Object.entries(input.query ?? {}).map(
          ([key, value]): [string, string] => [key, String(value)],
        ),
      );
      return request(
        input,
        `/api/v1/cli/artifacts?${query}`,
        artifactPageSchema,
      );
    },
    getRecord(input: ProjectInput & { readonly recordId: string }) {
      return request(
        input,
        `/api/v1/cli/records/${encodeURIComponent(input.recordId)}`,
        storedRecordSchema.nullable(),
      );
    },
    listRecords(input: ProjectInput & { readonly query?: ArtifactQuery }) {
      return request(
        input,
        `/api/v1/cli/records?${new URLSearchParams(Object.entries(input.query ?? {}).map(([key, value]): [string, string] => [key, String(value)]))}`,
        recordPageSchema,
      );
    },
    getAgentCall(input: ProjectInput & AgentCallRef) {
      return request(
        input,
        "/api/v1/agent/agent-calls/get",
        agentCallViewSchema,
        { runId: input.runId, callId: input.callId },
      );
    },
    claimAgentCall(input: ProjectInput & AgentCallClaim) {
      return request(
        input,
        "/api/v1/agent/agent-calls/claim",
        agentClaimResultSchema,
        { runId: input.runId, callId: input.callId, claimId: input.claimId },
      );
    },
    callAgentTool(input: ProjectInput & AgentToolCall) {
      return request(input, "/api/v1/agent/agent-calls/tool", z.json(), {
        runId: input.runId,
        callId: input.callId,
        ownerToken: input.ownerToken,
        toolCallId: input.toolCallId,
        toolId: input.toolId,
        input: input.input,
      });
    },
    readAgentAsset(input: ProjectInput & AgentAssetRequest) {
      return request(
        input,
        "/api/v1/agent/agent-calls/asset",
        agentAssetResultSchema,
        {
          runId: input.runId,
          callId: input.callId,
          ownerToken: input.ownerToken,
          assetId: input.assetId,
        },
      );
    },
    completeAgentCall(input: ProjectInput & AgentCallCompletion) {
      return request(
        input,
        "/api/v1/agent/agent-calls/complete",
        serviceRunViewSchema,
        {
          runId: input.runId,
          callId: input.callId,
          ownerToken: input.ownerToken,
          result: input.result,
        },
      );
    },
    failAgentCall(input: ProjectInput & AgentCallFailure) {
      return request(
        input,
        "/api/v1/agent/agent-calls/fail",
        serviceRunViewSchema,
        {
          runId: input.runId,
          callId: input.callId,
          ownerToken: input.ownerToken,
          message: input.message,
        },
      );
    },
    watchRun(input: RunInput, options?: ObserveOptions) {
      return observe(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/events`,
        options,
      );
    },
    watchProject(input: ProjectInput, options?: ObserveOptions) {
      return observe(input, "/api/v1/cli/events", options);
    },
    async waitRun(
      input: WaitRunInput,
      options: ObserveOptions = {},
    ): Promise<CoreResult<WaitRunResult>> {
      const controller = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      const timer = setTimeout(
        () => controller.abort(),
        input.timeoutMs ?? 300000,
      );
      let last: ServiceRunView | undefined;
      let meta: CoreMeta = { requestId: randomUUID(), runId: input.runId };
      try {
        for await (const event of core.watchRun(input, {
          signal: controller.signal,
        })) {
          meta = event.meta;
          if (!event.ok) {
            const { data: _data, ...result } = event;
            return { ...result, ...(last ? { data: { run: last } } : {}) };
          }
          if (event.data.type === "service_closing")
            return {
              ok: false,
              error: {
                code: "CLI_SERVICE_CLOSING",
                message: "The observed Service is closing.",
                retryable: false,
              },
              outcome: "not_applied",
              meta,
              ...(last ? { data: { run: last } } : {}),
            };
          if (event.data.type !== "run_snapshot") continue;
          last = event.data.run;
          const reason =
            last.status === "completed" || last.status === "failed"
              ? "terminal"
              : input.until !== "terminal" && last.pendingAction
                ? "human_action"
                : input.until !== "terminal" && last.pendingAgentCall
                  ? "agent_action"
                  : undefined;
          if (reason) return { ok: true, data: { run: last, reason }, meta };
        }
        return {
          ok: false,
          error: {
            code: options.signal?.aborted
              ? "OBSERVATION_CANCELLED"
              : "OBSERVATION_TIMEOUT",
            message: "Observation ended; the Run was not cancelled.",
            retryable: false,
          },
          outcome: "not_applied",
          meta,
          ...(last ? { data: { run: last } } : {}),
        };
      } finally {
        clearTimeout(timer);
        controller.abort();
        options.signal?.removeEventListener("abort", abort);
      }
    },
  };
  return core;
}
export type CliCore = ReturnType<typeof createCliCore>;
