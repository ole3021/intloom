import assert from "node:assert/strict";
import { z } from "zod";
import type {
  Blueprint,
  BlueprintStage,
  BlueprintStep,
} from "../src/workflow/blueprint.ts";
import type { RuntimeErrorCode } from "../src/errors/runtime.ts";
import { resolveCurrentExecution } from "../src/runtime/resolve-current-execution.ts";
import type { RunState } from "../src/runtime/run-state.ts";

export const now = new Date("2026-10-05T00:02:00Z");

export function routingFixture() {
  let initializations = 0;
  const runStep: BlueprintStep = {
    stepName: "run",
    execution: { kind: "code", codeId: "flow/first/run" },
    on: {
      complete: { kind: "step", stepName: "review" },
      retry: { kind: "step", stepName: "run" },
      end: { kind: "stage_end" },
      reenter: { kind: "stage_end" },
      finish: { kind: "stage_end" },
    },
  };
  const review: BlueprintStep = {
    stepName: "review",
    execution: { kind: "agent", agentId: "flow/first/review" },
    on: {
      retry: { kind: "step", stepName: "run" },
      complete: { kind: "stage_end" },
    },
  };
  const first: BlueprintStage = {
    stageName: "first",
    stateSchema: z.object({ activation: z.number() }),
    initializeState: () => ({ activation: ++initializations }),
    entryStepName: "run",
    steps: { review, run: runStep },
    on: {
      complete: { kind: "stage", stageName: "second" },
      end: { kind: "stage", stageName: "second" },
      reenter: { kind: "stage", stageName: "first" },
      finish: { kind: "workflow_end" },
    },
  };
  const launch: BlueprintStep = {
    stepName: "launch",
    execution: { kind: "code", codeId: "flow/second/launch" },
    on: { done: { kind: "stage_end" } },
  };
  const second: BlueprintStage = {
    ...first,
    stageName: "second",
    entryStepName: "launch",
    steps: { unused: { ...launch, stepName: "unused" }, launch },
    on: { done: { kind: "workflow_end" } },
  };
  const blueprint: Blueprint = {
    flowName: "flow",
    entryStageName: "first",
    stages: { second, first },
  };
  const run: RunState = {
    id: "RUN-1",
    execution: { source: "cli", agentExecutor: "service" },
    flowName: blueprint.flowName,
    intent: "original text",
    cursor: {
      stageName: blueprint.entryStageName,
      stepName: first.entryStepName,
    },
    status: "running",
    createdAt: new Date("2026-10-05T00:00:00Z"),
    updatedAt: new Date("2026-10-05T00:01:00Z"),
  };
  return {
    blueprint,
    run,
    first,
    second,
    runStep,
    initializations: () => initializations,
  };
}

export function execution(blueprint: Blueprint, run: RunState) {
  const resolved = resolveCurrentExecution(blueprint, run);
  assert.equal(resolved.kind, "execute");
  if (resolved.kind !== "execute") throw new Error("Expected execution");
  return resolved;
}

export function rejectsUnchanged(
  run: RunState,
  code: RuntimeErrorCode,
  action: () => unknown,
) {
  const before = {
    ...run,
    cursor: { ...run.cursor },
    createdAt: new Date(run.createdAt),
    updatedAt: new Date(run.updatedAt),
  };
  const cursor = run.cursor;
  const updatedAt = run.updatedAt;
  assert.throws(action, { code, retryable: false });
  assert.deepEqual(run, before);
  assert.equal(run.cursor, cursor);
  assert.equal(run.updatedAt, updatedAt);
}
