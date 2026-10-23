import type {
  Admission,
  OperationReceipt,
  OperationQuery,
} from "./api-contracts.ts";
import {
  listMirrors,
  inspectMirror,
  exportMirrors,
  resumeRunSchema,
} from "./mirrors.ts";
import type { AgentCallApi } from "../execution/delegated/contracts.ts";
import { getLogger } from "@intloom/utils";
import type { ProjectClient } from "./contracts.ts";
import type { OperationsPorts } from "./ports.ts";
import type { ServiceStatus } from "../host/contracts.ts";
import type { RunSource } from "./entry.ts";
import { getArtifact, listArtifacts } from "./artifacts.ts";
import { errorView, failure } from "../errors.ts";

/** The host owns resources; protocol adapters borrow business operations without owning their lifecycle. */
export interface ProjectOperations
  extends Pick<
      ProjectClient,
      | "getRun"
      | "listRuns"
      | "listLooms"
      | "getArtifact"
      | "listArtifacts"
      | "getRecord"
    >,
    AgentCallApi {
  readonly source: RunSource;
  admit(
    kind: OperationReceipt["kind"],
    input: Record<string, unknown> & {
      operationId: string;
      serviceInstanceId: string;
    },
    runId?: string,
  ): Promise<Admission>;
  findRun(
    startedBy: import("../runtime/contracts.ts").OperationRef,
  ): Promise<import("../runtime/run-view.ts").RunView | null>;
  getOperation(serviceInstanceId: string, operationId: string): OperationQuery;
  listMirrors(): Promise<unknown[]>;
  inspectMirror(mirrorId: string): ReturnType<typeof inspectMirror>;
  restoreMirror(
    input: Omit<import("./mirrors.ts").RestoreMirrorInput, "sourceProject">,
  ): ReturnType<OperationsPorts["restoreMirror"]>;
  exportMirrors(
    traceId: string,
    target: string,
  ): ReturnType<typeof exportMirrors>;
  status(): Promise<ServiceStatus>;
}

export function createOperations(
  ports: OperationsPorts,
  source: RunSource,
): ProjectOperations {
  function assertOpen(runId?: string) {
    ports.assertOpen();
    if (runId) getLogger().debug("run_requested", { runId });
  }
  function agentRuntime(runId: string, requested = true) {
    assertOpen(requested ? runId : undefined);
    if (source !== "agent_ide")
      throw failure(
        "INVALID_REQUEST",
        "Agent tasks are available only through the external Agent IDE entry.",
      );
    return ports.delegated;
  }
  async function queryRun<T>(
    runId: string,
    query: () => T | Promise<T>,
  ): Promise<T> {
    try {
      return await query();
    } catch (error) {
      getLogger().warn("run_query_failed", {
        runId,
        errorCode: errorView(error).code,
      });
      throw error;
    }
  }
  const actions = {
    source,
    getAgentCall: (request) =>
      queryRun(request.runId, () =>
        agentRuntime(request.runId, false).getAgentCall(request),
      ),
    claimAgentCall: (request) =>
      agentRuntime(request.runId).claimAgentCall(request),
    callAgentTool: (request) =>
      agentRuntime(request.runId).callAgentTool(request),
    readAgentAsset: (request) =>
      queryRun(request.runId, () =>
        agentRuntime(request.runId, false).readAgentAsset(request),
      ),
    completeAgentCall: (request) =>
      agentRuntime(request.runId).completeAgentCall(request),
    failAgentCall: (request) =>
      agentRuntime(request.runId).failAgentCall(request),
    async findRun(startedBy) {
      assertOpen();
      const run = await ports.runtime.findRun(startedBy);
      return run ? ports.presentRun(run) : null;
    },
    async getRun(runId) {
      return queryRun(runId, async () => {
        assertOpen();
        return ports.presentRun(await ports.runtime.getRun(runId));
      });
    },
    async listRuns(loomName) {
      assertOpen();
      return (await ports.runtime.listRuns(loomName)).map((run) =>
        ports.presentRun(run),
      );
    },
    async listLooms() {
      assertOpen();
      return ports.listLooms(source);
    },
    async getArtifact(selector) {
      assertOpen();
      return getArtifact(ports.storage, selector);
    },
    async listArtifacts(query) {
      assertOpen();
      return listArtifacts(ports.storage, query);
    },
    async getRecord(recordId) {
      assertOpen();
      return (await ports.storage.getRecordById(recordId)) ?? null;
    },
    listMirrors() {
      assertOpen();
      return listMirrors(ports.projectRoot);
    },
    inspectMirror(mirrorId) {
      assertOpen();
      return inspectMirror(ports.projectRoot, mirrorId);
    },
    restoreMirror(input) {
      assertOpen();
      return ports.restoreMirror({
        ...input,
        sourceProject: ports.projectRoot,
      });
    },
    exportMirrors(traceId, target) {
      assertOpen();
      return exportMirrors(ports.projectRoot, traceId, target);
    },
    async status() {
      assertOpen();
      return ports.status();
    },
  } satisfies Omit<ProjectOperations, "admit" | "getOperation">;
  return Object.freeze({
    ...actions,
    getOperation: (instance: string, id: string) =>
      ports.receipts.get(instance, id),
    async admit(kind, input, runId) {
      const receipt = await ports.receipts.admit(
        {
          kind,
          source,
          serviceInstanceId: input.serviceInstanceId,
          operationId: input.operationId,
          ...(runId ? { target: runId } : {}),
          parameters: input,
        },
        async () => {
          try {
            ports.assertOpen();
          } catch (error) {
            return { status: "not_applied", error } as const;
          }
          const runtime = ports.runtime;
          const operation = {
            serviceInstanceId: input.serviceInstanceId,
            operationId: input.operationId,
          };
          if (kind === "run")
            return ports.startRun(
              String(input.loomName),
              input.input as import("@intloom/loom-sdk").LoomInput,
              source,
              operation,
            );
          if (!runId)
            return {
              status: "not_applied",
              error: failure(
                "INVALID_REQUEST",
                "The operation requires a Run ID.",
              ),
            };
          if (kind === "answer")
            return runtime.submitAnswer(
              runId,
              String(input.actionId),
              input.answer as import("@intloom/loom-sdk").ReadonlyJsonValue,
              operation,
            );
          if (kind === "pause") return runtime.pauseRun(runId);
          if (kind === "stop") return runtime.cancelRun(runId);
          const parsed = resumeRunSchema.safeParse(input);
          if (!parsed.success)
            return {
              status: "not_applied",
              error: failure("INVALID_REQUEST", "Invalid resume request."),
            };
          return runtime.resumeRun(runId, parsed.data);
        },
      );
      if (receipt.status !== "accepted") return { receipt };
      // A later query failure cannot invalidate an already recorded admission.
      const run = await actions.getRun(receipt.runId).catch(() => undefined);
      return {
        receipt,
        ...(run
          ? { run: run as import("./api-contracts.ts").ServiceRunView }
          : {}),
      };
    },
  } satisfies ProjectOperations);
}
