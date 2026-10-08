import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { resolveCurrentExecution } from "./resolve-current-execution.ts";

import {
  routingFixture,
  rejectsUnchanged,
} from "../../test/routing-fixture.ts";

describe("resolveCurrentExecution", () => {
  test("resolves the explicit cursor without enumeration, initialization or mutation", () => {
    const { blueprint, run, first, runStep, initializations } =
      routingFixture();
    const before = structuredClone(run);
    assert.deepEqual(resolveCurrentExecution(blueprint, run), {
      kind: "execute",
      stage: first,
      step: runStep,
    });
    assert.deepEqual(run, before);
    assert.equal(initializations(), 0);
  });

  test("waiting and terminal states halt at their last valid cursor", () => {
    for (const status of ["waiting", "completed", "failed"] as const) {
      const { blueprint, run } = routingFixture();
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
      assert.deepEqual(resolveCurrentExecution(blueprint, run), {
        kind: "halt",
      });
    }
  });

  test("rejects missing, malformed and inherited cursor references even in terminal states", () => {
    for (const cursor of [
      { stageName: "missing", stepName: "run" },
      { stageName: "first", stepName: "missing" },
      { stageName: "constructor", stepName: "run" },
      { stageName: "first", stepName: "toString" },
      { stageName: "", stepName: "run" },
    ]) {
      const { blueprint, run } = routingFixture();
      run.cursor = cursor;
      run.status = "completed";
      rejectsUnchanged(run, "INVALID_CURSOR", () =>
        resolveCurrentExecution(blueprint, run),
      );
    }
    const { blueprint, run, first } = routingFixture();
    rejectsUnchanged(run, "INVALID_CURSOR", () =>
      resolveCurrentExecution(
        { ...blueprint, stages: Object.create({ first }) },
        run,
      ),
    );
    const inherited = { ...first, steps: Object.create(first.steps) };
    rejectsUnchanged(run, "INVALID_CURSOR", () =>
      resolveCurrentExecution(
        { ...blueprint, stages: { first: inherited } },
        run,
      ),
    );
  });

  test("rejects cursor definitions whose names disagree with the dictionary keys", () => {
    const { blueprint, run, first, runStep } = routingFixture();
    for (const stage of [
      { ...first, stageName: "other" },
      { ...first, steps: { run: { ...runStep, stepName: "other" } } },
    ]) {
      rejectsUnchanged(run, "INVALID_CURSOR", () =>
        resolveCurrentExecution(
          { ...blueprint, stages: { first: stage } },
          run,
        ),
      );
    }
  });

  test("rejects a different Flow and inconsistent Run state", () => {
    const { blueprint, run } = routingFixture();
    run.flowName = "other";
    rejectsUnchanged(run, "RUN_STATE_INVALID", () =>
      resolveCurrentExecution(blueprint, run),
    );
    run.flowName = blueprint.flowName;
    run.status = "waiting";
    rejectsUnchanged(run, "RUN_STATE_INVALID", () =>
      resolveCurrentExecution(blueprint, run),
    );
  });
});
