import {
  flow,
  listWorkflows,
  getRun,
  listRuns,
  cancelRun,
  answerAsk,
  type AgentCallApi,
} from "@intloom/kernel";
import { getLogger } from "@intloom/utils";
import type { ProjectClient } from "../client/contracts.ts";
import type { ProjectHost } from "../service/host.ts";
import type { ServiceStatus } from "../service/contracts.ts";
import type { RunSource } from "./entry.ts";
import { getArtifact, listArtifacts } from "./artifacts.ts";
import { failure } from "../errors.ts";

/** The host owns resources; protocol adapters borrow business operations without owning their lifecycle. */
export interface ProjectApplication
  extends Omit<ProjectClient, "close">,
    AgentCallApi {
  readonly source: RunSource;
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
      return flow(host.execution, flowName, intent, source);
    },
    async getRun(runId) {
      assertOpen(runId);
      return getRun(host.execution, runId);
    },
    async listRuns(flowName) {
      assertOpen();
      return listRuns(host.execution, flowName);
    },
    async listWorkflows() {
      assertOpen();
      return listWorkflows(host.execution, source);
    },
    async answerAsk(runId, actionId, answer) {
      assertOpen(runId);
      return answerAsk(host.execution, runId, actionId, answer);
    },
    async cancelRun(runId) {
      assertOpen(runId);
      await cancelRun(host.execution, runId);
      return getRun(host.execution, runId);
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
    async status() {
      assertOpen();
      return host.status();
    },
  } satisfies ProjectApplication);
}
