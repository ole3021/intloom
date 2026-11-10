import type { MockRun } from "./state.ts";
import type { InteractionRequest, RunEventInput } from "@intloom/loom-sdk";
import { pending } from "./run-state.ts";
import { validateInput } from "./input.ts";
import { resolveConfiguration } from "../shared/selectors.ts";
import type { Launch, Settings } from "../shared/types.ts";
export function record(run: MockRun, event: RunEventInput, time: string) {
  run.events.push({
    ...event,
    schemaVersion: 1,
    runId: run.summary.id,
    seq: run.events.length + 1,
    time,
  });
  run.summary = { ...run.summary, updatedAt: time };
}
function callModel(run: MockRun, slot: "planner" | "reviewer", time: string) {
  const binding = run.binding[slot],
    executionId = `${run.summary.id}-${slot}`,
    scope = { executionId, origin: { componentId: slot } };
  record(
    run,
    {
      ...scope,
      type: "model.invocation.started",
      details: {
        invocationId: executionId,
        slot,
        provider: binding.provider,
        model: binding.model,
      },
    },
    time,
  );
  record(
    run,
    {
      ...scope,
      type: "model.step.finished",
      details: {
        invocationId: executionId,
        step: 1,
        inputTokens: slot === "planner" ? 2880 : 750,
        outputTokens: slot === "planner" ? 980 : 250,
      },
    },
    time,
  );
  record(
    run,
    {
      ...scope,
      type: "model.invocation.finished",
      details: {
        invocationId: executionId,
        status: "succeeded",
        stepCount: 1,
        durationMs: 0,
      },
    },
    time,
  );
}
export function requestInteraction(
  run: MockRun,
  kind: "ask" | "approval",
  message: string,
  time: string,
) {
  const id = `${run.summary.id}-request${run.requests.length + 1}`,
    executionId = `${id}-step`,
    origin = { componentId: run.stage };
  const request: InteractionRequest = {
    id,
    runId: run.summary.id,
    kind,
    origin,
    executionId,
    message,
    context: run.stage === "final" ? run.candidate?.name : run.outline,
    answerSchema:
      kind === "ask"
        ? { type: "string" }
        : { type: "object", properties: { approved: { type: "boolean" } } },
    responsePolicy: kind === "ask" ? "any" : "human",
    status: "pending",
    createdAt: time,
  };
  run.requests.push(request);
  run.summary = {
    ...run.summary,
    status: "waiting",
    waits: [
      ...run.summary.waits,
      { kind: "interaction", waitId: id, requestId: id, origin },
    ],
    pendingInteractionIds: [...run.summary.pendingInteractionIds, id],
  };
  run.nextAt = null;
  record(
    run,
    {
      type: "interaction.requested",
      executionId,
      origin,
      details: { requestId: id, waitId: id, kind },
    },
    time,
  );
  record(
    run,
    {
      type: "run.waiting",
      details: { waitIds: run.summary.waits.map((w) => w.waitId) },
    },
    time,
  );
}
export function end(
  run: MockRun,
  status: "succeeded" | "failed" | "cancelled",
  time: string,
) {
  for (const request of pending(run)) {
    const i = run.requests.indexOf(request);
    run.requests[i] = {
      ...request,
      status: "closed",
      closed: { at: time, reason: "run_ended" },
    };
    record(
      run,
      {
        type: "interaction.closed",
        origin: request.origin,
        executionId: request.executionId,
        details: { requestId: request.id, reason: "run_ended" },
      },
      time,
    );
  }
  run.summary = {
    ...run.summary,
    status,
    finishedAt: time,
    waits: [],
    pendingInteractionIds: [],
  };
  run.stage = "end";
  run.nextAt = null;
  record(
    run,
    {
      type:
        status === "succeeded"
          ? "run.succeeded"
          : status === "failed"
            ? "run.failed"
            : "run.cancelled",
    },
    time,
  );
}
function attachCandidate(run: MockRun, time: string) {
  const format = ["demo-presentation", "ppt-generator"].includes(
    run.launch.loom,
  )
    ? "pptx"
    : ["demo-photo", "photo-editor"].includes(run.launch.loom)
      ? run.launch.command === "learn"
        ? "json"
        : "zip"
      : "md";
  const mediaType = {
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    json: "application/json",
    md: "text/markdown",
  }[format];
  run.candidate = {
    id: `${run.summary.id}-v1`,
    runId: run.summary.id,
    name:
      run.title.replace(/[\\/:*?"<>|\p{Cc}]/gu, "_").slice(0, 85) +
      "." +
      format,
    version: 1,
    mediaType,
    format,
    createdAt: time,
  };
}
function deliver(run: MockRun, time: string) {
  run.delivered = true;
  if (run.launch.finalConfirmation)
    run.summary = { ...run.summary, deliveryStatus: "approved" };
  run.position = run.steps.length - 1;
  record(
    run,
    { type: "outcome.delivered", details: { quality: "passed" } },
    time,
  );
  end(run, "succeeded", time);
}
export function makeRun(
  draft: Launch,
  settings: Settings,
  time: string,
  id: string,
  via: MockRun["via"],
): MockRun {
  const pkg = validateInput(draft),
    binding = resolveConfiguration(settings, draft.projectDir, draft.profileId);
  const isDeck = ["ppt-generator", "demo-presentation"].includes(draft.loom),
    title = String(
      draft.input.goal ??
        draft.input.title ??
        draft.input.name ??
        draft.input.directory,
    ).trim();
  const steps = [
    "读取素材",
    isDeck ? "拟定文稿内容" : "整理素材",
    isDeck ? "制作演示稿" : "处理内容",
    "检查与交付",
  ];
  const outline = [
    `${title} · 目标与背景`,
    "核心内容与示例",
    "行动计划与下一步",
  ];
  const run: MockRun = {
    summary: {
      id,
      status: "created",
      loom: pkg.ref,
      command: draft.command,
      location: {
        storage: "global",
        dataDir: "mock://studio",
        ...(draft.projectDir ? { projectDir: draft.projectDir } : {}),
      },
      createdAt: time,
      updatedAt: time,
      waits: [],
      pendingInteractionIds: [],
    },
    title,
    via,
    launch: structuredClone(draft),
    binding,
    steps,
    position: 0,
    stage: "work",
    nextAt: Date.parse(time) + 2500,

    events: [],
    requests: [],
    answers: [],
    delivered: false,
    rejected: false,
    outline,
  };
  record(run, { type: "run.created" }, time);
  run.summary = { ...run.summary, status: "running", startedAt: time };
  record(run, { type: "run.started" }, time);
  return run;
}
export function advance(run: MockRun, time: string) {
  if (run.summary.status === "stopping") {
    end(run, "cancelled", time);
    return;
  }
  if (run.summary.status !== "running") return;
  if (run.position === 0 && run.binding.startupIssue) {
    run.summary = {
      ...run.summary,
      error: { code: "HARNESS_UNAVAILABLE", message: run.binding.startupIssue },
    };
    end(run, "failed", time);
    return;
  }
  if (run.stage === "delivering") {
    deliver(run, time);
    return;
  }
  if (run.position === 0) {
    run.position = 1;
  } else if (run.position === 1 && run.stage === "work") {
    callModel(run, "planner", time);
    if (run.launch.input.outline || run.launch.input.ask) {
      run.stage = "outline";
      const approval = !!run.launch.input.outline;
      requestInteraction(
        run,
        approval ? "approval" : "ask",
        approval ? "请确认大纲 v1" : "这份报告面向哪些读者？",
        time,
      );
      return;
    }
    run.position = 2;
  } else if (run.position < 3) {
    run.position++;
  } else {
    callModel(run, "reviewer", time);
    attachCandidate(run, time);
    run.stage = "preparing";
    run.nextAt = null;
    return;
  }
  record(
    run,
    {
      type: "log",
      details: { level: "info", message: run.steps[run.position] },
    },
    time,
  );
  run.nextAt = Date.parse(time) + 2200;
}

export function candidateReady(run: MockRun, time: string) {
  if (run.stage !== "preparing" || run.summary.status !== "running") return;
  const candidate = run.candidate;
  if (!candidate) throw Error("缺少候选文件。");
  record(
    run,
    {
      type: "artifact.created",
      origin: { componentId: "delivery" },
      executionId: `${run.summary.id}-delivery`,
      details: { artifactId: candidate.id },
    },
    time,
  );
  if (run.launch.finalConfirmation) {
    run.stage = "final";
    run.summary = { ...run.summary, deliveryStatus: "pending" };
    requestInteraction(run, "approval", "请确认交付这个固定版本", time);
  } else deliver(run, time);
}
