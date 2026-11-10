import type { ResponseSource, InteractionReceipt } from "@intloom/loom-sdk";
import type { Action } from "../shared/types.ts";
import type { MockRun, MockState } from "./state.ts";
import { launchPackage } from "../shared/catalog.ts";
import { record, end } from "./lifecycle.ts";
import { pending } from "./run-state.ts";
export function respond(
  state: MockState,
  action: Extract<Action, { type: "answer" }>,
  actor: ResponseSource["kind"],
  now: number,
): InteractionReceipt {
  const time = new Date(now).toISOString();
  const run = state.runs.find((run) =>
      pending(run).some((request) => request.id === action.requestId),
    ),
    request = run?.requests.find((request) => request.id === action.requestId);
  if (!run || !request || !["waiting", "running"].includes(run.summary.status))
    throw Error("这个请求已关闭或已处理。");
  if (
    request.kind === "approval"
      ? typeof action.value !== "boolean"
      : typeof action.value !== "string" || !action.value.trim()
  )
    throw Error("请提交有效回答。");
  if (request.responsePolicy === "human" && actor !== "human")
    throw Error("RESPONSE_SOURCE_NOT_ALLOWED · 这项确认需要本人操作。");
  const source: ResponseSource = { kind: actor, via: "api" };
  const responseId = `${request.id}-answer`;
  run.answers.push({
    id: responseId,
    requestId: request.id,
    receivedAt: time,
    source,
    action: "submit",
    value:
      request.kind === "approval"
        ? { approved: action.value as boolean }
        : action.value,
  });
  run.requests[run.requests.indexOf(request)] = {
    ...request,
    status: "answered",
    answerResponseId: responseId,
  };
  run.summary = {
    ...run.summary,
    pendingInteractionIds: run.summary.pendingInteractionIds.filter(
      (id) => id !== request.id,
    ),
  };
  record(
    run,
    {
      type: "interaction.responded",
      executionId: request.executionId,
      origin: request.origin,
      details: {
        requestId: request.id,
        responseId,
        action: "submit",
        kind: request.kind,
        source,
        ...(request.kind === "approval"
          ? { approved: action.value as boolean }
          : {}),
      },
    },
    time,
  );
  const wait = run.summary.waits.find((w) => w.requestId === request.id);
  const canContinue =
    wait && state.installed.includes(launchPackage(run.launch));
  if (canContinue) continueWait(run, wait.waitId, now);
  return {
    runId: run.summary.id,
    requestId: request.id,
    responseId,
    requestStatus: "answered",
    continuation: canContinue
      ? { status: "requested" }
      : {
          status: "needs_attention",
          message: "回答已保存，原等待点或执行包暂不可用。",
        },
  };
}
export function continueWait(run: MockRun, waitId: string, now: number) {
  const wait = run.summary.waits.find((w) => w.waitId === waitId);
  if (
    !["waiting", "running"].includes(run.summary.status) ||
    !wait ||
    wait.kind === "child"
  )
    throw Error("没有可继续的等待点。已中断的 Run 请用原输入新建。");
  const request = wait.requestId
    ? run.requests.find((q) => q.id === wait.requestId)
    : undefined;
  if (wait.kind === "interaction" && request?.status !== "answered")
    throw Error("请先回答这项请求。");
  const time = new Date(now).toISOString();
  record(run, { type: "run.resume.requested", details: { waitId } }, time);
  const waits = run.summary.waits.filter((w) => w.waitId !== waitId);
  const answer = run.answers.find((a) => a.id === request?.answerResponseId);
  if (
    answer?.action === "submit" &&
    typeof answer.value === "object" &&
    answer.value !== null &&
    "approved" in answer.value &&
    answer.value.approved === false
  )
    run.rejected = true;
  run.summary = {
    ...run.summary,
    waits,
    status: waits.length ? "waiting" : "running",
  };
  if (waits.length) return;
  record(run, { type: "run.resumed" }, time);
  if (run.rejected) {
    if (run.stage === "final")
      run.summary = { ...run.summary, deliveryStatus: "rejected" };
    end(run, "succeeded", time);
    return;
  }
  run.stage = run.stage === "final" ? "delivering" : "reviewed";
  run.position = run.stage === "delivering" ? 3 : 2;
  run.nextAt = now + 2200;
}
