import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { realpath, open } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isLoomError, withLogger } from "@intloom/utils";
import * as z from "zod";
import type { AgentExecutionAccess, JsonValue } from "@intloom/loom-sdk";
import type { LoadedAgent } from "../../loom/types.ts";
import {
  agentJsonSchema,
  executeAgentTool,
  assertToolActive,
  agentToolEndsCall,
} from "../agent-tool.ts";
import { ERRORS } from "../../errors.ts";
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
  AgentSubmissionReceipt,
  DelegatedContext,
  DelegatedSessions,
  PendingAgentCall,
  AgentWaitHandle,
} from "./contracts.ts";

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
  readonly context: DelegatedContext;
  readonly pending: PendingAgentCall;
  wait?: AgentWaitHandle;
  closed: boolean;
  expiresAt?: number;
  completion?: AgentCompletionReceipt;
  readonly resource: LoadedAgent;
  readonly task: AgentTask;
  readonly assets: ReadonlyMap<string, string>;
  readonly receipts: Map<string, ToolReceipt>;
  readonly access: (assertTool: () => void) => AgentExecutionAccess<JsonValue>;
  readonly resolve: (result: unknown) => void;
  readonly reject: (cause: unknown) => void;
  claim?: { readonly id: string; readonly token: string };
  busy: boolean;
  toolsClosed?: boolean;
}
export interface AgentCompletionReceipt {
  readonly callId: string;
  readonly ownerToken: string;
  readonly kind: "complete" | "fail";
  readonly value: JsonValue;
  readonly result: Promise<AgentSubmissionReceipt>;
}

export function createDelegatedSessions(
  now: () => number = Date.now,
): DelegatedSessions {
  const sessions = new Map<string, AgentCallControl>();
  function prune() {
    for (const [id, control] of sessions)
      if (control.expiresAt !== undefined && control.expiresAt <= now())
        sessions.delete(id);
  }
  function session(request: AgentCallRef): AgentCallControl {
    prune();
    text(request.runId);
    text(request.callId);
    const control = sessions.get(request.callId);
    if (!control || control.task.runId !== request.runId) conflict();
    return control;
  }
  function begin(
    resource: LoadedAgent,
    context: DelegatedContext,
  ): Promise<unknown> {
    context.scope.assertCurrent();
    prune();
    const callId = context.scope.callId;
    if (sessions.has(callId)) conflict();
    const assets = new Map<string, string>();
    const task: AgentTask = {
      runId: context.scope.runId,
      callId,
      agentId: resource.agentId,
      cursor: { ...context.cursor },
      instructions: resource.spec.instructions,
      ...(context.input !== undefined
        ? { input: structuredClone(context.input) }
        : {}),
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
    let resolveResult!: (result: unknown) => void;
    let rejectResult!: (cause: unknown) => void;
    const promise = new Promise<unknown>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    void promise.catch(() => {});
    const pending: PendingAgentCall = {
      id: callId,
      agentId: resource.agentId,
      phase: "available",
      createdAt: new Date().toISOString(),
    };
    const control: AgentCallControl = {
      context,
      resource,
      task,
      assets,
      pending,
      access: context.access,
      receipts: new Map(),
      busy: false,
      closed: false,
      resolve: resolveResult,
      reject: rejectResult,
    };
    sessions.set(callId, control);
    const abort = () => {
      control.closed = true;
      control.reject(context.scope.signal.reason);
    };
    context.scope.signal.addEventListener("abort", abort, { once: true });
    void context.closedAndSettled.then(() => {
      context.scope.signal.removeEventListener("abort", abort);
      control.closed = true;
      control.expiresAt = now() + 30 * 60 * 1000;
    });
    try {
      control.wait = context.beginWait(pending);
    } catch (cause) {
      control.closed = true;
      rejectResult(cause);
      throw cause;
    }
    return promise;
  }
  return {
    begin,
    async getAgentCall(request) {
      return getAgentCall(session(request), request);
    },
    async claimAgentCall(request) {
      return claimAgentCall(session(request), request);
    },
    async callAgentTool(request) {
      return callAgentTool(session(request), request);
    },
    async readAgentAsset(request) {
      return readAgentAsset(session(request), request);
    },
    async completeAgentCall(request) {
      return completeAgentCall(session(request), request);
    },
    async failAgentCall(request) {
      return failAgentCall(session(request), request);
    },
  };
}

function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 512)
    throw ERRORS.create("INVALID_REQUEST", {
      message:
        "Agent call identities must be nonblank text of at most 512 characters.",
    });
}
function conflict(): never {
  throw ERRORS.create("CONFLICT", {
    message: "This Agent call or its ownership is no longer current.",
  });
}
function active(
  control: AgentCallControl,
  request: AgentCallRef,
): AgentCallControl {
  text(request.runId);
  text(request.callId);
  if (
    control.closed ||
    control.task.runId !== request.runId ||
    control.task.callId !== request.callId
  )
    conflict();
  control.context.scope.assertCurrent();
  return control;
}
function owned(
  session: AgentCallControl,
  request: AgentCallOwner,
): AgentCallControl {
  text(request.ownerToken);
  const control = active(session, request);
  if (!control.claim || control.claim.token !== request.ownerToken) conflict();
  return control;
}

export function getAgentCall(
  session: AgentCallControl,
  request: AgentCallRef,
): AgentCallView {
  const control = active(session, request);
  const pending = control.pending;
  if (!pending) conflict();
  return structuredClone({
    pending: { ...pending, phase: control.claim ? "claimed" : "available" },
    task: control.task,
    receipts: [...control.receipts].map(([toolCallId, receipt]) => ({
      toolCallId,
      toolId: receipt.toolId,
      status: receipt.status,
    })),
  });
}
export function claimAgentCall(
  session: AgentCallControl,
  request: AgentCallClaim,
) {
  text(request.claimId);
  const control = active(session, request);
  if (control.claim && control.claim.id !== request.claimId) conflict();
  if (!control.claim) {
    control.claim = {
      id: request.claimId,
      token: randomBytes(32).toString("base64url"),
    };
    const pending = control.pending;
    if (!pending) conflict();
    control.wait?.claimed();
  }
  return {
    task: structuredClone(control.task),
    ownerToken: control.claim.token,
  };
}

export async function callAgentTool(
  session: AgentCallControl,
  request: AgentToolCall,
): Promise<JsonValue> {
  text(request.toolCallId);
  text(request.toolId);
  text(request.ownerToken);
  const control = session;
  if (control.claim?.token !== request.ownerToken) conflict();
  const input = copyJson(request.input);
  const previous = control.receipts.get(request.toolCallId);
  if (previous) {
    if (
      previous.toolId !== request.toolId ||
      !isDeepStrictEqual(previous.input, input)
    )
      conflict();
    const value = await previous.result;
    return structuredClone(value);
  }
  owned(session, request);
  const tool = control.resource.spec.tools.find(
    (tool) => tool.id === request.toolId,
  );
  if (control.toolsClosed)
    throw ERRORS.create("INVALID_REQUEST", {
      message:
        "This Agent has saved its final submission. Complete the call with the required outcome without more Tools.",
    });
  if (!tool)
    throw ERRORS.create("INVALID_REQUEST", {
      message: "The Agent has not declared this Tool.",
    });
  if (control.busy)
    throw ERRORS.create("BUSY", {
      message: "An Agent Tool is already running.",
    });
  if (control.receipts.size >= receiptLimit)
    throw ERRORS.create("BUSY", {
      message: `The Agent call has reached its ${receiptLimit} Tool receipt limit. Complete or cancel this call.`,
    });
  control.busy = true;
  let toolActive = true;
  const access = control.access(() => {
    assertToolActive(toolActive);
    owned(session, request);
  });
  // Cache the complete operation, including post-execution authority and final-submission checks.
  const result = Promise.resolve().then(async () => {
    try {
      let finishObservation: (() => void) | undefined;
      let value: JsonValue;
      try {
        finishObservation = control.context.observeTool(request.toolCallId);
        value = await withLogger(control.context.logger, async () => {
          owned(session, request);
          return executeAgentTool(tool, structuredClone(input), access);
        });
        owned(session, request);
        if (agentToolEndsCall(tool, value)) {
          control.toolsClosed = true;
          control.context.logger.debug("agent_tools_closed", {
            toolName: tool.id,
          });
        }
      } finally {
        toolActive = false;
        control.busy = false;
        finishObservation?.();
      }
      receipt.status = "completed";
      return value;
    } catch (cause) {
      receipt.status = "failed";
      if (
        !control.closed &&
        !(isLoomError(cause) && cause.code === "INVALID_REQUEST")
      ) {
        resume(control);
        control.reject(
          ERRORS.is(cause)
            ? cause
            : ERRORS.wrap("STEP_EXECUTION_FAILED", cause),
        );
      }
      throw cause;
    }
  });
  const receipt: ToolReceipt = {
    toolId: request.toolId,
    input,
    result,
    status: "running",
  };
  control.receipts.set(request.toolCallId, receipt);
  return structuredClone(await result);
}

export async function readAgentAsset(
  session: AgentCallControl,
  request: AgentAssetRequest,
) {
  text(request.assetId);
  const control = owned(session, request);
  const asset = control.assets.get(request.assetId);
  if (!asset)
    throw ERRORS.create("NOT_FOUND", {
      message: "Unknown Agent asset.",
    });
  const root = await realpath(control.resource.source.assetRoot);
  const file = await realpath(resolve(root, asset));
  const path = relative(root, file);
  if (isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`))
    throw ERRORS.create("INVALID_REQUEST", {
      message: "Agent asset escapes its package.",
    });
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > assetLimit)
      throw ERRORS.create("INVALID_REQUEST", {
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
    if (length > assetLimit) throw ERRORS.create("INVALID_REQUEST");
    bytes = buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
  owned(session, request);
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
    throw ERRORS.create("INVALID_REQUEST", {
      message: "Agent input and results must be JSON.",
    });
  }
}
function resume(control: AgentCallControl): void {
  control.context.scope.assertCurrent();
  control.wait?.finish();
  control.closed = true;
}
function finish(
  session: AgentCallControl,
  request: AgentCallOwner,
  kind: "complete" | "fail",
  value: JsonValue,
): Promise<AgentSubmissionReceipt> {
  text(request.runId);
  text(request.callId);
  text(request.ownerToken);
  const receipt = session.completion;
  if (
    receipt?.callId === request.callId &&
    receipt.ownerToken === request.ownerToken &&
    session.task.runId === request.runId
  ) {
    if (receipt.kind !== kind || !isDeepStrictEqual(receipt.value, value))
      conflict();
    return receipt.result.then((run) => structuredClone(run));
  }
  const control = owned(session, request);
  if (control.busy)
    throw ERRORS.create("BUSY", {
      message: "Wait for the Agent Tool before completing this call.",
    });
  resume(control);
  const result = Promise.resolve({
    runId: request.runId,
    callId: request.callId,
    status: "accepted" as const,
  });
  session.completion = {
    callId: request.callId,
    ownerToken: request.ownerToken,
    kind,
    value: structuredClone(value),
    result,
  };
  if (kind === "complete") control.resolve(value);
  else
    control.reject(
      ERRORS.create("STEP_EXECUTION_FAILED", {
        message: "The client Agent reported execution failure.",
      }),
    );
  return result.then((run) => structuredClone(run));
}
export function completeAgentCall(
  session: AgentCallControl,
  request: AgentCallCompletion,
) {
  return finish(session, request, "complete", copyJson(request.result));
}
export function failAgentCall(
  session: AgentCallControl,
  request: AgentCallFailure,
) {
  if (
    typeof request.message !== "string" ||
    !request.message.trim() ||
    request.message.length > 4096
  )
    throw ERRORS.create("INVALID_REQUEST", {
      message:
        "Agent failure needs a nonblank message of at most 4096 characters.",
    });
  return finish(session, request, "fail", request.message);
}
