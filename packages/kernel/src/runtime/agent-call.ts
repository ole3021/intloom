import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { realpath, open } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { generateId, isLoomError, withLogger } from "@intloom/utils";
import * as z from "zod";
import type { AgentExecutionAccess, JsonValue } from "@intloom/workflow-sdk";
import type { LoadedAgent } from "../workflow/types.ts";
import {
  agentJsonSchema,
  executeAgentTool,
  assertToolActive,
} from "../effector/agent-tool.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import { assertCallOwnership } from "./call-scope.ts";
import {
  notifyRunObservers,
  waitUntilStable,
  type RunEntry,
} from "./run-entry.ts";
import type { RunView } from "./run-view.ts";
import type {
  AgentTask,
  AgentCallOwner,
  AgentCallRef,
  AgentCallClaim,
  AgentToolCall,
  AgentCallCompletion,
  AgentCallFailure,
  AgentAssetRequest,
  AgentCallView,
} from "./agent-call-types.ts";

const receiptLimit = 256;
const assetLimit = 1024 * 1024;
interface ToolReceipt {
  readonly toolId: string;
  readonly input: JsonValue;
  readonly result: Promise<JsonValue>;
  status: "running" | "completed" | "failed";
}
/** Control references are private to this retained invocation; business State stays in StageState. */
export interface AgentCallControl {
  readonly call: AbortController;
  readonly resource: LoadedAgent;
  readonly task: AgentTask;
  readonly assets: ReadonlyMap<string, string>;
  readonly receipts: Map<string, ToolReceipt>;
  readonly access: (assertTool: () => void) => AgentExecutionAccess<JsonValue>;
  readonly resolve: (result: unknown) => void;
  readonly reject: (cause: unknown) => void;
  claim?: { readonly id: string; readonly token: string };
  busy: boolean;
}
export interface AgentCompletionReceipt {
  readonly callId: string;
  readonly ownerToken: string;
  readonly kind: "complete" | "fail";
  readonly value: JsonValue;
  readonly result: Promise<RunView>;
}

export function suspendAgentCall(
  entry: RunEntry,
  call: AbortController,
  resource: LoadedAgent,
  access: AgentCallControl["access"],
): Promise<unknown> {
  assertCallOwnership(entry, call);
  if (entry.state.status !== "running" || entry.reply || entry.agentCall)
    throw RUNTIME_ERRORS.create("RUN_STATE_INVALID");
  const callId = generateId("CALL");
  const assets = new Map<string, string>();
  const task: AgentTask = {
    runId: entry.state.id,
    callId,
    agentId: resource.agentId,
    cursor: { ...entry.state.cursor },
    instructions: resource.spec.instructions,
    skills: resource.spec.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      assets: skill.assets.map((name) => {
        const id = `asset_${assets.size}`;
        assets.set(id, name);
        return { id, name };
      }),
    })),
    tools: resource.spec.tools.map((tool) => ({
      id: tool.id,
      description: tool.description,
      inputSchema: agentJsonSchema(tool.inputSchema),
      outputSchema: agentJsonSchema(tool.outputSchema, "output"),
    })),
    outputSchema: agentJsonSchema(resource.spec.outputSchema),
  };
  const promise = new Promise<unknown>((resolveResult, reject) => {
    entry.agentCall = {
      call,
      resource,
      task,
      assets,
      access,
      receipts: new Map(),
      busy: false,
      resolve: resolveResult,
      reject,
    };
  });
  // Cancellation can reject before the execution layer attaches its continuation.
  void promise.catch(() => {});
  delete entry.agentReceipt;
  entry.state.pendingAgentCall = {
    id: callId,
    agentId: resource.agentId,
    phase: "available",
    createdAt: new Date().toISOString(),
  };
  entry.state.status = "waiting";
  entry.state.updatedAt = new Date();
  entry.waitStartedAt = performance.now();
  saveCheckpoint(entry, "waiting");
  (entry.activeLog ?? entry.logger).info("agent_call_waiting", {
    callId,
    agentId: resource.agentId,
  });
  notifyRunObservers(entry);
  return promise;
}

function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 512)
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message:
        "Agent call identities must be nonblank text of at most 512 characters.",
    });
}
function conflict(): never {
  throw KERNEL_ERRORS.create("CONFLICT", {
    message: "This Agent call or its ownership is no longer current.",
  });
}
function active(entry: RunEntry, request: AgentCallRef): AgentCallControl {
  text(request.runId);
  text(request.callId);
  const control = entry.agentCall;
  if (
    entry.state.id !== request.runId ||
    entry.state.execution.agentExecutor !== "mcp_client" ||
    entry.state.execution.source !== "agent_ide" ||
    entry.state.status !== "waiting" ||
    entry.state.pendingAgentCall?.id !== request.callId ||
    !control
  )
    conflict();
  assertCallOwnership(entry, control.call);
  return control;
}
function owned(entry: RunEntry, request: AgentCallOwner): AgentCallControl {
  text(request.ownerToken);
  const control = active(entry, request);
  if (!control.claim || control.claim.token !== request.ownerToken) conflict();
  return control;
}

export function getAgentCall(
  entry: RunEntry,
  request: AgentCallRef,
): AgentCallView {
  const control = active(entry, request);
  const pending = entry.state.pendingAgentCall;
  if (!pending) conflict();
  return structuredClone({
    pending,
    task: control.task,
    receipts: [...control.receipts].map(([toolCallId, receipt]) => ({
      toolCallId,
      toolId: receipt.toolId,
      status: receipt.status,
    })),
  });
}
export function claimAgentCall(entry: RunEntry, request: AgentCallClaim) {
  text(request.claimId);
  const control = active(entry, request);
  if (control.claim && control.claim.id !== request.claimId) conflict();
  if (!control.claim) {
    control.claim = {
      id: request.claimId,
      token: randomBytes(32).toString("base64url"),
    };
    const pending = entry.state.pendingAgentCall;
    if (!pending) conflict();
    entry.state.pendingAgentCall = {
      ...pending,
      phase: "claimed",
    };
    entry.state.updatedAt = new Date();
    saveCheckpoint(entry, "waiting");
  }
  return {
    task: structuredClone(control.task),
    ownerToken: control.claim.token,
  };
}

export async function callAgentTool(
  entry: RunEntry,
  request: AgentToolCall,
): Promise<JsonValue> {
  text(request.toolCallId);
  text(request.toolId);
  const control = owned(entry, request);
  const input = copyJson(request.input);
  owned(entry, request);
  const previous = control.receipts.get(request.toolCallId);
  if (previous) {
    if (
      previous.toolId !== request.toolId ||
      !isDeepStrictEqual(previous.input, input)
    )
      conflict();
    const value = await previous.result;
    owned(entry, request);
    return structuredClone(value);
  }
  const tool = control.resource.spec.tools.find(
    (tool) => tool.id === request.toolId,
  );
  if (!tool)
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "The Agent has not declared this Tool.",
    });
  if (control.busy)
    throw KERNEL_ERRORS.create("BUSY", {
      message: "An Agent Tool is already running.",
    });
  if (control.receipts.size >= receiptLimit)
    throw KERNEL_ERRORS.create("BUSY", {
      message: `The Agent call has reached its ${receiptLimit} Tool receipt limit. Complete or cancel this call.`,
    });
  control.busy = true;
  let toolActive = true;
  const access = control.access(() => {
    assertToolActive(toolActive);
    owned(entry, request);
  });
  const result = Promise.resolve().then(() =>
    withLogger(entry.activeLog ?? entry.logger, async () => {
      owned(entry, request);
      return executeAgentTool(tool, structuredClone(input), access);
    }),
  );
  const receipt: ToolReceipt = {
    toolId: request.toolId,
    input,
    result,
    status: "running",
  };
  control.receipts.set(request.toolCallId, receipt);
  try {
    const value = await result;
    owned(entry, request);
    receipt.status = "completed";
    return structuredClone(value);
  } catch (cause) {
    receipt.status = "failed";
    if (
      entry.agentCall === control &&
      !(isLoomError(cause) && cause.code === "INVALID_REQUEST")
    ) {
      resume(entry, control);
      control.reject(
        RUNTIME_ERRORS.is(cause)
          ? cause
          : RUNTIME_ERRORS.wrap("STEP_EXECUTION_FAILED", cause),
      );
    }
    throw cause;
  } finally {
    toolActive = false;
    control.busy = false;
  }
}

export async function readAgentAsset(
  entry: RunEntry,
  request: AgentAssetRequest,
) {
  text(request.assetId);
  const control = owned(entry, request);
  const asset = control.assets.get(request.assetId);
  if (!asset)
    throw KERNEL_ERRORS.create("NOT_FOUND", {
      message: "Unknown Agent asset.",
    });
  const root = await realpath(control.resource.source.assetRoot);
  const file = await realpath(resolve(root, asset));
  const path = relative(root, file);
  if (isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`))
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Agent asset escapes its package.",
    });
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > assetLimit)
      throw KERNEL_ERRORS.create("INVALID_REQUEST", {
        message: "Agent assets must be files of at most 1 MiB.",
      });
    const buffer = Buffer.alloc(assetLimit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > assetLimit) throw KERNEL_ERRORS.create("INVALID_REQUEST");
    bytes = buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
  owned(entry, request);
  try {
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf8" as const,
    };
  } catch {
    return { content: bytes.toString("base64"), encoding: "base64" as const };
  }
}

function copyJson(value: unknown): JsonValue {
  try {
    return structuredClone(z.json().parse(value));
  } catch {
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Agent input and results must be JSON.",
    });
  }
}
function resume(entry: RunEntry, control: AgentCallControl): void {
  assertCallOwnership(entry, control.call);
  delete entry.state.pendingAgentCall;
  delete entry.agentCall;
  entry.state.status = "running";
  entry.state.updatedAt = new Date();
  try {
    saveCheckpoint(entry, "executing");
  } catch (cause) {
    control.reject(cause);
    throw cause;
  }
  entry.waitDurationMs +=
    entry.waitStartedAt === undefined
      ? 0
      : Math.round(performance.now() - entry.waitStartedAt);
  delete entry.waitStartedAt;
}
function finish(
  entry: RunEntry,
  request: AgentCallOwner,
  kind: "complete" | "fail",
  value: JsonValue,
): Promise<RunView> {
  text(request.runId);
  text(request.callId);
  text(request.ownerToken);
  const receipt = entry.agentReceipt;
  if (
    receipt?.callId === request.callId &&
    receipt.ownerToken === request.ownerToken &&
    entry.state.id === request.runId
  ) {
    if (receipt.kind !== kind || !isDeepStrictEqual(receipt.value, value))
      conflict();
    return receipt.result.then((run) => structuredClone(run));
  }
  const control = owned(entry, request);
  if (control.busy)
    throw KERNEL_ERRORS.create("BUSY", {
      message: "Wait for the Agent Tool before completing this call.",
    });
  resume(entry, control);
  const result = waitUntilStable(entry);
  entry.agentReceipt = {
    callId: request.callId,
    ownerToken: request.ownerToken,
    kind,
    value: structuredClone(value),
    result,
  };
  notifyRunObservers(entry);
  if (kind === "complete") control.resolve(value);
  else
    control.reject(
      RUNTIME_ERRORS.create("STEP_EXECUTION_FAILED", {
        message: "The client Agent reported execution failure.",
      }),
    );
  return result.then((run) => structuredClone(run));
}
export function completeAgentCall(
  entry: RunEntry,
  request: AgentCallCompletion,
) {
  return finish(entry, request, "complete", copyJson(request.result));
}
export function failAgentCall(entry: RunEntry, request: AgentCallFailure) {
  if (
    typeof request.message !== "string" ||
    !request.message.trim() ||
    request.message.length > 4096
  )
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message:
        "Agent failure needs a nonblank message of at most 4096 characters.",
    });
  return finish(entry, request, "fail", request.message);
}
