import * as z from "zod";
import { agentSubmissionReceiptSchema } from "@intloom/kernel/operations";
import {
  agentCallViewSchema,
  agentClaimResultSchema,
  agentAssetResultSchema,
} from "@intloom/kernel/operations";
import type {
  AgentCallRef,
  AgentCallClaim,
  AgentToolCall,
  AgentAssetRequest,
  AgentCallCompletion,
  AgentCallFailure,
} from "@intloom/kernel";
import type { ProjectInput } from "./contracts.ts";

import { request } from "../client/http.ts";

export function createAgentsOperations() {
  return {
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
        agentSubmissionReceiptSchema,
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
        agentSubmissionReceiptSchema,
        {
          runId: input.runId,
          callId: input.callId,
          ownerToken: input.ownerToken,
          message: input.message,
        },
      );
    },
  };
}
