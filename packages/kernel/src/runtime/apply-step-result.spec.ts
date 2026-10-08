import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyStepResult } from "./apply-step-result.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { resolveCurrentExecution } from "./resolve-current-execution.ts";
import type { Resolution } from "./routing.ts";

import {
  now,
  routingFixture,
  execution,
  rejectsUnchanged,
} from "../../test/routing-fixture.ts";

describe("applyStepResult", () => {
  test("moves and loops Steps while returning move_step and preserving Run identity", () => {
    const { blueprint, run, initializations } = routingFixture();
    const createdAt = run.createdAt;
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "complete" },
        now,
      ),
      { kind: "move_step" },
    );
    assert.deepEqual(run.cursor, { stageName: "first", stepName: "review" });
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "retry" },
        now,
      ),
      { kind: "move_step" },
    );
    assert.deepEqual(run.cursor, { stageName: "first", stepName: "run" });
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "retry" },
        now,
      ),
      { kind: "move_step" },
    );
    assert.equal(run.status, "running");
    assert.equal(run.id, "RUN-1");
    assert.equal(run.intent, "original text");
    assert.equal(run.createdAt, createdAt);
    assert.deepEqual(run.updatedAt, now);
    assert.equal(initializations(), 0);
  });

  test("stage_end uses the same outcome and selects the target Stage entry", () => {
    const { blueprint, run, second, initializations } = routingFixture();
    const transition = applyStepResult(
      blueprint,
      run,
      execution(blueprint, run),
      { outcome: "end" },
      now,
    );
    assert.deepEqual(transition, { kind: "enter_stage", stage: second });
    assert.deepEqual(run.cursor, { stageName: "second", stepName: "launch" });
    assert.equal(run.status, "running");
    assert.equal(initializations(), 0);
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "done" },
        now,
      ),
      { kind: "complete" },
    );
    assert.equal(run.status, "completed");
    assert.deepEqual(run.cursor, { stageName: "second", stepName: "launch" });
    assert.deepEqual(resolveCurrentExecution(blueprint, run), { kind: "halt" });
  });

  test("same Stage and same entry cursor still require enter_stage", () => {
    const { blueprint, run, first, initializations } = routingFixture();
    const cursor = { ...run.cursor };
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "reenter" },
        now,
      ),
      { kind: "enter_stage", stage: first },
    );
    assert.deepEqual(run.cursor, cursor);
    assert.equal(initializations(), 0);
  });

  test("completes without a virtual end cursor and detaches the supplied timestamp", () => {
    const { blueprint, run } = routingFixture();
    const cursor = run.cursor;
    const time = new Date(now);
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "finish" },
        time,
      ),
      { kind: "complete" },
    );
    time.setTime(0);
    assert.equal(run.cursor, cursor);
    assert.deepEqual(run.updatedAt, now);
    assert.equal(run.status, "completed");
  });

  test("rejects an invalid result without changing Run state", () => {
    const { blueprint, run } = routingFixture();
    const executed = execution(blueprint, run);
    rejectsUnchanged(run, "STEP_RESULT_INVALID", () =>
      applyStepResult(blueprint, run, executed, { outcome: "" }, now),
    );
  });

  test("rejects unhandled or unnormalized outcomes, including inherited Step routes", () => {
    const { blueprint, run, runStep } = routingFixture();
    const executed = execution(blueprint, run);
    for (const outcome of [
      "unknown",
      " complete ",
      "Complete",
      "constructor",
      "toString",
    ]) {
      rejectsUnchanged(run, "STEP_OUTCOME_NOT_HANDLED", () =>
        applyStepResult(blueprint, run, executed, { outcome }, now),
      );
    }
    Object.assign(runStep, { on: Object.create(runStep.on) });
    rejectsUnchanged(run, "STEP_OUTCOME_NOT_HANDLED", () =>
      applyStepResult(blueprint, run, executed, { outcome: "complete" }, now),
    );
  });

  test("rejects absent and inherited Stage routes for the ending outcome", () => {
    const { blueprint, run, first } = routingFixture();
    const executed = execution(blueprint, run);
    for (const on of [{}, Object.create(first.on)]) {
      Object.assign(first, { on });
      rejectsUnchanged(run, "STEP_OUTCOME_NOT_HANDLED", () =>
        applyStepResult(blueprint, run, executed, { outcome: "end" }, now),
      );
    }
  });

  test("explicit own prototype-like outcomes are valid routes", () => {
    const { blueprint, run, runStep } = routingFixture();
    Object.defineProperty(runStep.on, "constructor", {
      value: { kind: "step", stepName: "review" },
    });
    assert.deepEqual(
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "constructor" },
        now,
      ),
      { kind: "move_step" },
    );
  });

  test("invalid Step targets and transition kinds leave the cursor and timestamp intact", () => {
    const { blueprint, run, runStep } = routingFixture();
    const executed = execution(blueprint, run);
    for (const next of [
      { kind: "step", stepName: "missing" },
      { kind: "step", stepName: "constructor" },
      { kind: "unknown" },
    ]) {
      Object.assign(runStep.on, { complete: next });
      rejectsUnchanged(run, "INVALID_TRANSITION", () =>
        applyStepResult(blueprint, run, executed, { outcome: "complete" }, now),
      );
    }
  });

  test("validates target Stage, its name and its entry Step before entering it", () => {
    const { blueprint, run, first, second } = routingFixture();
    const executed = execution(blueprint, run);
    for (const next of [
      { kind: "stage", stageName: "missing" },
      { kind: "stage", stageName: "constructor" },
      { kind: "unknown" },
    ]) {
      Object.assign(first.on, { end: next });
      rejectsUnchanged(run, "INVALID_TRANSITION", () =>
        applyStepResult(blueprint, run, executed, { outcome: "end" }, now),
      );
    }
    Object.assign(first.on, { end: { kind: "stage", stageName: "second" } });
    for (const target of [
      { ...second, stageName: "other" },
      { ...second, entryStepName: "missing" },
      { ...second, entryStepName: "constructor" },
      { ...second, steps: Object.create(second.steps) },
    ]) {
      Object.assign(blueprint.stages, { second: target });
      rejectsUnchanged(run, "INVALID_TRANSITION", () =>
        applyStepResult(blueprint, run, executed, { outcome: "end" }, now),
      );
    }
  });

  test("rejects results from a moved cursor or a different definition object", () => {
    const { blueprint, run } = routingFixture();
    const executed = execution(blueprint, run);
    const impostor: Extract<Resolution, { kind: "execute" }> = {
      ...executed,
      step: { ...executed.step },
    };
    rejectsUnchanged(run, "EXECUTION_OWNERSHIP_LOST", () =>
      applyStepResult(blueprint, run, impostor, { outcome: "complete" }, now),
    );
    applyStepResult(blueprint, run, executed, { outcome: "complete" }, now);
    rejectsUnchanged(run, "EXECUTION_OWNERSHIP_LOST", () =>
      applyStepResult(blueprint, run, executed, { outcome: "complete" }, now),
    );
  });

  test("late results preserve waiting actions, completed Runs and RUN_STOPPED", () => {
    for (const status of ["waiting", "completed", "failed"] as const) {
      const { blueprint, run } = routingFixture();
      const executed = execution(blueprint, run);
      run.status = status;
      if (status === "waiting") {
        run.pendingAction = {
          id: "ASK-1",
          flowName: run.flowName,
          cursor: { ...run.cursor },
          kind: "user_ask_confirmation",
          request: { question: "Continue?" },
          createdAt: run.updatedAt.toISOString(),
        };
      }
      if (status === "failed")
        run.lastError = RUNTIME_ERRORS.create("RUN_STOPPED");
      rejectsUnchanged(run, "EXECUTION_OWNERSHIP_LOST", () =>
        applyStepResult(blueprint, run, executed, { outcome: "complete" }, now),
      );
    }
  });

  test("rejects invalid transition times before committing any state", () => {
    const { blueprint, run } = routingFixture();
    rejectsUnchanged(run, "RUN_STATE_INVALID", () =>
      applyStepResult(
        blueprint,
        run,
        execution(blueprint, run),
        { outcome: "finish" },
        new Date("invalid"),
      ),
    );
  });
});
