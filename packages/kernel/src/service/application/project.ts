import {
  listMirrors,
  inspectMirror,
  restoreMirror,
  exportMirrors,
  resumeRunSchema,
} from "./mirrors.ts";
import {
  listWorkflows,
  getRun,
  listRuns,
  cancelRun,
  type AgentCallApi,
} from "../../index.ts";
import { getLogger } from "@intloom/utils";
import type { ProjectClient } from "./contracts.ts";
import type { ProjectHost } from "../host.ts";
import type { ServiceStatus } from "../contracts.ts";
import type { RunSource } from "./entry.ts";
import { getArtifact, listArtifacts } from "./artifacts.ts";
import { failure } from "../errors.ts";

/** The host owns resources; protocol adapters borrow business operations without owning their lifecycle. */
export interface ProjectApplication
  extends Omit<ProjectClient, "close">,
    AgentCallApi {
  readonly source: RunSource;
  listMirrors(): Promise<unknown[]>;
  inspectMirror(mirrorId: string): ReturnType<typeof inspectMirror>;
  restoreMirror(
    input: Omit<import("./mirrors.ts").RestoreMirrorInput, "sourceProject">,
  ): ReturnType<typeof restoreMirror>;
  exportMirrors(
    traceId: string,
    target: string,
  ): ReturnType<typeof exportMirrors>;
  resumeRun(
    runId: string,
    input: import("zod").infer<typeof resumeRunSchema>,
  ): Promise<import("../../runtime/run-view.ts").RunView>;
  status(): Promise<ServiceStatus>;
}

export function createProjectApplication(
  host: ProjectHost,
  source: RunSource,
): ProjectApplication {
  function assertOpen(runId?: string) {
    host.assertOpen();
    if (runId) getLogger().debug("run_requested", { runId });
  }
  function agentRuntime(runId: string) {
    assertOpen(runId);
    if (source !== "agent_ide")
      throw failure(
        "INVALID_REQUEST",
        "Agent tasks are available only through the external Agent IDE entry.",
      );
    return host.execution.runtime;
  }
  return Object.freeze({
    source,
    getAgentCall: (request) =>
      agentRuntime(request.runId).getAgentCall(request),
    claimAgentCall: (request) =>
      agentRuntime(request.runId).claimAgentCall(request),
    callAgentTool: (request) =>
      agentRuntime(request.runId).callAgentTool(request),
    readAgentAsset: (request) =>
      agentRuntime(request.runId).readAgentAsset(request),
    completeAgentCall: (request) =>
      agentRuntime(request.runId).completeAgentCall(request),
    failAgentCall: (request) =>
      agentRuntime(request.runId).failAgentCall(request),
    async flow(flowName, intent) {
      assertOpen();
      return host.presentRun(await host.startFlow(flowName, intent, source));
    },
    async getRun(runId) {
      assertOpen(runId);
      return host.presentRun(await getRun(host.execution, runId));
    },
    async listRuns(flowName) {
      assertOpen();
      return (await listRuns(host.execution, flowName)).map((run) =>
        host.presentRun(run),
      );
    },
    async listWorkflows() {
      assertOpen();
      return listWorkflows(host.execution, source);
    },
    async answerAsk(runId, actionId, answer) {
      assertOpen(runId);
      return host.presentRun(
        host.execution.runtime.submitAnswer(runId, actionId, answer),
      );
    },
    async cancelRun(runId) {
      assertOpen(runId);
      await cancelRun(host.execution, runId);
      return host.presentRun(await getRun(host.execution, runId));
    },
    async getArtifact(selector) {
      assertOpen();
      return getArtifact(host.storage.access, selector);
    },
    async listArtifacts(query) {
      assertOpen();
      return listArtifacts(host.storage.access, query);
    },
    async getRecord(recordId) {
      assertOpen();
      return (await host.storage.access.getRecordById(recordId)) ?? null;
    },
    listMirrors() {
      assertOpen();
      return listMirrors(host.info.projectRoot);
    },
    inspectMirror(mirrorId) {
      assertOpen();
      return inspectMirror(host.info.projectRoot, mirrorId);
    },
    restoreMirror(input) {
      assertOpen();
      return restoreMirror({ ...input, sourceProject: host.info.projectRoot });
    },
    exportMirrors(traceId, target) {
      assertOpen();
      return exportMirrors(host.info.projectRoot, traceId, target);
    },
    resumeRun(runId, input) {
      assertOpen(runId);
      return host.execution.runtime.resumeRun(
        runId,
        resumeRunSchema.parse(input),
      );
    },
    async status() {
      assertOpen();
      return host.status();
    },
  } satisfies ProjectApplication);
}
