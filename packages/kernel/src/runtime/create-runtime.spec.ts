import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { describe, test } from "node:test";
import { Agent } from "@mastra/core/agent";
import * as z from "zod";
import {
  runtimeFixture,
  deferred,
  fixtureStateSchema,
} from "../../test/runtime-fixture.ts";
import type { JsonValue } from "../shared/json.ts";
import type { CodeExecutionAccess } from "../effector/execution.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { createRuntime } from "./create-runtime.ts";

describe("createRuntime", () => {
  test("flow runs an explicit multi-Step multi-Stage path and preserves original intent", async () => {
    const f = runtimeFixture();
    let old: CodeExecutionAccess<JsonValue> | undefined;
    f.codes.start = async (input, access) => {
      assert.equal(input, null);
      assert.deepEqual(access.state.value, {
        value: 0,
        intent: "  original  ",
      });
      old = access;
      await access.state.update({ value: 42, intent: "  original  " });
      return { outcome: "complete" };
    };
    f.codes.review = (_input, access) => {
      assert.equal(fixtureStateSchema.parse(access.state.value).value, 42);
      return { outcome: "complete" };
    };
    f.codes.finish = (_input, access) => {
      assert.equal(fixtureStateSchema.parse(access.state.value).value, 0);
      return { outcome: "complete" };
    };
    const runtime = createRuntime(f.options);
    const view = await runtime.flow(f.blueprint, "  original  ");
    assert.equal(view.status, "completed");
    assert.match(view.runId, /^RUN-/u);
    assert.deepEqual(view.cursor, {
      stageName: "second",
      stepName: "finish",
    });
    assert.deepEqual(
      f.contexts.map((context) => context.runId),
      [view.runId, view.runId],
    );
    assert.deepEqual(f.events, ["init:first", "init:second"]);
    assert.equal((await runtime.listRuns()).length, 1);
    assert.ok(old);
    await assert.rejects(old.state.clear(), {
      code: "EXECUTION_OWNERSHIP_LOST",
    });
  });

  test("queries observe running initialization, detach snapshots and do not update time", async () => {
    const f = runtimeFixture();
    const entered = deferred<void>();
    const seed = deferred<JsonValue>();
    Object.assign(f.first, {
      initializeState: () => {
        entered.resolve();
        return seed.promise;
      },
    });
    const runtime = createRuntime(f.options);
    const completion = runtime.flow(f.blueprint, "text");
    await entered.promise;
    const views = await runtime.listRuns("fixture");
    assert.equal(views.length, 1);
    const view = views[0];
    assert.ok(view);
    assert.equal(view.status, "running");
    assert.deepEqual(await runtime.listRuns("other"), []);
    Object.assign(view.cursor, { stepName: "caller_change" });
    const next = await runtime.getRun(view.runId);
    assert.equal(next.cursor.stepName, "start");
    assert.equal(next.updatedAt, view.updatedAt);
    await assert.rejects(runtime.getRun("unknown"), { code: "NOT_FOUND" });
    seed.resolve({ intent: "text" });
    assert.equal((await completion).status, "completed");
  });

  test("invalid intents and invalid entries fail before registering a Run", async () => {
    const f = runtimeFixture();
    const runtime = createRuntime(f.options);
    for (const text of ["", "  "])
      await assert.rejects(runtime.flow(f.blueprint, text), {
        code: "INVALID_REQUEST",
      });
    await assert.rejects(
      runtime.flow({ ...f.blueprint, entryStageName: "constructor" }, "text"),
      { code: "INVALID_CURSOR" },
    );
    await assert.rejects(
      runtime.flow(
        {
          ...f.blueprint,
          stages: { first: { ...f.first, entryStepName: "missing" } },
        },
        "text",
      ),
      { code: "INVALID_CURSOR" },
    );
    assert.deepEqual(await runtime.listRuns(), []);
    assert.deepEqual(f.events, []);
  });

  test("initializer exceptions and invalid seeds fail before executing the entry", async () => {
    for (const initializeState of [
      () => {
        throw new Error("private seed failure");
      },
      () => ({ value: "bad" }),
    ]) {
      const f = runtimeFixture();
      Object.assign(f.first, { initializeState });
      const view = await createRuntime(f.options).flow(f.blueprint, "text");
      assert.equal(view.status, "failed");
      assert.equal(view.lastError?.code, "RUN_INITIALIZATION_FAILED");
      assert.deepEqual(view.cursor, {
        stageName: "first",
        stepName: "start",
      });
      assert.deepEqual(f.events, []);
      assert.equal(
        JSON.stringify(view).includes("private seed failure"),
        false,
      );
    }
  });

  test("Stage transition initialization failure keeps the target cursor and revokes old access", async () => {
    const f = runtimeFixture();
    let access: CodeExecutionAccess<JsonValue> | undefined;
    f.codes.review = (_input, value) => {
      access = value;
      return { outcome: "complete" };
    };
    Object.assign(f.second, {
      initializeState: () => {
        throw new Error("failed second Stage");
      },
    });
    const view = await createRuntime(f.options).flow(f.blueprint, "text");
    assert.equal(view.lastError?.code, "RUN_INITIALIZATION_FAILED");
    assert.deepEqual(view.cursor, {
      stageName: "second",
      stepName: "finish",
    });
    assert.equal(f.events.includes("code:finish"), false);
    assert.ok(access);
    await assert.rejects(access.state.clear(), {
      code: "EXECUTION_OWNERSHIP_LOST",
    });
  });

  test("execution failures are projected and existing Runtime errors retain their code", async () => {
    for (const cause of [
      new Error("private cause"),
      RUNTIME_ERRORS.create("STAGE_STATE_INVALID"),
    ]) {
      const f = runtimeFixture();
      f.codes.start = () => {
        throw cause;
      };
      const view = await createRuntime(f.options).flow(f.blueprint, "text");
      assert.equal(view.status, "failed");
      assert.equal(
        view.lastError?.code,
        RUNTIME_ERRORS.is(cause) ? cause.code : "STEP_EXECUTION_FAILED",
      );
      assert.equal(JSON.stringify(view).includes("private cause"), false);
      assert.deepEqual(f.events, ["init:first"]);
    }
  });

  test("invalid results and unhandled outcomes become failed Views without advancing", async () => {
    for (const [result, code] of [
      [{ outcome: "complete", data: {} }, "STEP_RESULT_INVALID"],
      [{ outcome: "unknown" }, "STEP_OUTCOME_NOT_HANDLED"],
    ] as const) {
      const f = runtimeFixture();
      f.codes.start = () => result;
      const view = await createRuntime(f.options).flow(f.blueprint, "text");
      assert.equal(view.lastError?.code, code);
      assert.equal(view.cursor.stepName, "start");
      assert.deepEqual(f.events, ["init:first"]);
    }
  });

  test("missing and inherited Code/Agent registrations fail without dispatch", async () => {
    for (const execution of [
      { kind: "code", codeId: "missing" },
      { kind: "code", codeId: "constructor" },
      { kind: "agent", agentId: "missing" },
      { kind: "agent", agentId: "constructor" },
    ] as const) {
      const f = runtimeFixture();
      assert.ok(f.first.steps.start);
      Object.assign(f.first.steps.start, { execution });
      const view = await createRuntime(f.options).flow(f.blueprint, "text");
      assert.equal(view.lastError?.code, "STEP_EXECUTION_FAILED");
      assert.deepEqual(f.events, ["init:first"]);
    }
  });

  test("dispatches the registered Agent through Effector with actual read-only Storage", async (t) => {
    const f = runtimeFixture();
    const fetch = t.mock.method(globalThis, "fetch", async () => {
      throw new Error("No real model calls");
    });
    const executable = {
      agent: new Agent({
        id: "fixture",
        name: "fixture",
        instructions: "fixture",
        model: "openai/gpt-4o",
      }),
      outputSchema: z.object({ outcome: z.string() }),
    };
    assert.ok(f.first.steps.review);
    Object.assign(f.first.steps.review, {
      execution: { kind: "agent", agentId: "reviewer" },
    });
    Object.assign(f.options.agents, { reviewer: executable });
    let agentCalls = 0;
    f.options.effector.executeAgent = async (agent, input, access) => {
      agentCalls++;
      assert.equal(agent, executable);
      assert.equal(input, null);
      assert.equal("commit" in access.storage, false);
      assert.equal("interaction" in access, false);
      assert.equal("run" in access, false);
      assert.equal(
        await access.storage.getArtifact("fixture", "first"),
        undefined,
      );
      await access.state.update({ value: 3, intent: "text" });
      return { outcome: "complete" };
    };
    assert.equal(
      (await createRuntime(f.options).flow(f.blueprint, "text")).status,
      "completed",
    );
    assert.equal(agentCalls, 1);
    assert.equal(fetch.mock.calls.length, 0);
  });

  test("Step loops retain State, Stage reentry resets it, and clearing State permits completion", async () => {
    const f = runtimeFixture();
    let calls = 0;
    let old: CodeExecutionAccess<JsonValue> | undefined;
    let commits = 0;
    let cleared = false;
    f.storage.commit = async () => {
      commits++;
      return {
        writtenArtifacts: [],
        appendedRecords: [],
        removedArtifactIds: [],
        removedRecordIds: [],
      };
    };
    f.codes.start = async (_input, access) => {
      calls++;
      if (calls === 1) {
        old = access;
        await access.state.update({ value: 1, intent: "text" });
        return { outcome: "retry" };
      }
      assert.ok(old);
      await assert.rejects(old.state.clear(), {
        code: "EXECUTION_OWNERSHIP_LOST",
      });
      await assert.rejects(old.storage.commit([]), {
        code: "EXECUTION_OWNERSHIP_LOST",
      });
      assert.throws(() => old?.interaction.confirm("stale"), {
        code: "EXECUTION_OWNERSHIP_LOST",
      });
      assert.equal(
        fixtureStateSchema.parse(access.state.value).value,
        calls === 2 ? 1 : 0,
      );
      return { outcome: calls === 2 ? "reenter" : "complete" };
    };
    f.codes.finish = async (_input, access) => {
      await access.state.clear();
      assert.equal(access.state.value, undefined);
      cleared = true;
      return { outcome: "complete" };
    };
    assert.equal(
      (await createRuntime(f.options).flow(f.blueprint, "text")).status,
      "completed",
    );
    assert.equal(calls, 3);
    assert.equal(cleared, true);
    assert.deepEqual(
      f.contexts.map((context) => context.stageName),
      ["first", "first", "second"],
    );
    assert.equal(commits, 0);
  });

  test("flow returns waiting while original Code remains unfinished and no next Step executes", async () => {
    const f = runtimeFixture();
    let calls = 0;
    let continued = false;
    let access: CodeExecutionAccess<JsonValue> | undefined;
    f.codes.start = async (_input, value) => {
      calls++;
      access = value;
      await value.interaction.confirm("Continue?");
      continued = true;
      return { outcome: "complete" };
    };
    const runtime = createRuntime(f.options);
    const view = await runtime.flow(f.blueprint, "text");
    assert.equal(view.status, "waiting");
    assert.equal(calls, 1);
    assert.equal(continued, false);
    assert.match(view.pendingAction?.id ?? "", /^ASK-/u);
    assert.deepEqual(view.pendingAction?.cursor, view.cursor);
    assert.deepEqual(view.pendingAction?.request, { context: "Continue?" });
    assert.ok(view.pendingAction);
    Object.assign(view.pendingAction.request, { context: "caller mutation" });
    await setImmediate();
    assert.deepEqual(
      (await runtime.getRun(view.runId)).pendingAction?.request,
      {
        context: "Continue?",
      },
    );
    assert.deepEqual(f.events, ["init:first"]);
    assert.ok(access);
    assert.deepEqual(access.state.value, { value: 0, intent: "text" });
    await assert.rejects(access.state.update({ value: 1, intent: "text" }), {
      code: "STAGE_STATE_INACTIVE",
    });
  });

  test("question requests are copied as JSON and optional undefined fields are omitted", async () => {
    const f = runtimeFixture();
    const questions = [
      {
        id: "Q1",
        question: "Question?",
        isSkippable: false,
        description: undefined,
      },
    ];
    f.codes.start = async (_input, access) => {
      const answer = access.interaction.askQuestions(questions);
      assert.ok(questions[0]);
      questions[0].question = "mutated";
      await answer;
      return { outcome: "complete" };
    };
    const view = await createRuntime(f.options).flow(f.blueprint, "text");
    assert.deepEqual(view.pendingAction?.request, [
      { id: "Q1", question: "Question?", isSkippable: false },
    ]);
  });

  test("invalid questions and confirmation contexts fail without publishing a waiting action", async () => {
    for (const kind of ["questions", "confirmation"]) {
      const f = runtimeFixture();
      f.codes.start = async (_input, access) => {
        if (kind === "questions") await access.interaction.askQuestions([]);
        else await access.interaction.confirm("");
        return { outcome: "complete" };
      };
      const view = await createRuntime(f.options).flow(f.blueprint, "text");
      assert.equal(view.lastError?.code, "STEP_INTERACTION_INVALID");
      assert.equal(view.pendingAction, undefined);
    }
  });

  test("unawaited and overlapping interactions are caught as protocol failures", async () => {
    for (const overlap of [false, true]) {
      const f = runtimeFixture();
      f.codes.start = (_input, access) => {
        void access.interaction.confirm("first");
        if (overlap) void access.interaction.confirm("second");
        return { outcome: "complete" };
      };
      const runtime = createRuntime(f.options);
      const initial = await runtime.flow(f.blueprint, "text");
      await setImmediate();
      const view = await runtime.getRun(initial.runId);
      assert.equal(view.status, "failed");
      assert.equal(view.lastError?.code, "STEP_INTERACTION_INVALID");
      assert.equal(view.pendingAction, undefined);
    }
  });

  test("background failure after flow returns waiting is captured and clears the action", async () => {
    const f = runtimeFixture();
    const gate = deferred<void>();
    f.codes.start = async (_input, access) => {
      void access.interaction.confirm("first");
      await gate.promise;
      throw new Error("private background failure");
    };
    const runtime = createRuntime(f.options);
    const waiting = await runtime.flow(f.blueprint, "text");
    assert.equal(waiting.status, "waiting");
    gate.resolve();
    await setImmediate();
    const view = await runtime.getRun(waiting.runId);
    assert.equal(view.status, "failed");
    assert.equal(view.lastError?.code, "STEP_EXECUTION_FAILED");
    assert.equal(view.pendingAction, undefined);
    assert.equal(
      JSON.stringify(view).includes("private background failure"),
      false,
    );
  });

  test("two Runs isolate access and State while one waits and another completes", async () => {
    const f = runtimeFixture();
    const accesses: CodeExecutionAccess<JsonValue>[] = [];
    f.codes.start = async (_input, access) => {
      accesses.push(access);
      const state = fixtureStateSchema.parse(access.state.value);
      await access.state.update({
        ...state,
        value: state.intent === "A" ? 1 : 2,
      });
      if (state.intent === "A") await access.interaction.confirm("A?");
      return { outcome: "complete" };
    };
    const runtime = createRuntime(f.options);
    const a = await runtime.flow(f.blueprint, "A");
    const b = await runtime.flow(f.blueprint, "B");
    assert.equal(a.status, "waiting");
    assert.equal(b.status, "completed");
    assert.notEqual(a.runId, b.runId);
    assert.notEqual(accesses[0], accesses[1]);
    assert.deepEqual(accesses[0]?.state.value, { value: 1, intent: "A" });
    assert.equal((await runtime.getRun(a.runId)).status, "waiting");
    assert.equal((await runtime.listRuns()).length, 2);
  });

  test("same-Stage asynchronous writes recheck call ownership before committing", async () => {
    const f = runtimeFixture();
    const started = deferred<void>();
    const release = deferred<void>();
    Object.assign(f.first, {
      stateSchema: fixtureStateSchema.superRefine(async (value) => {
        if (value.value === 99) {
          started.resolve();
          await release.promise;
        }
      }),
    });
    let write: Promise<void> | undefined;
    f.codes.start = async (_input, access) => {
      write = access.state.update({ value: 99, intent: "text" });
      void write.catch(() => {});
      await started.promise;
      return { outcome: "complete" };
    };
    f.codes.review = async (_input, access) => {
      release.resolve();
      assert.ok(write);
      await assert.rejects(write, { code: "EXECUTION_OWNERSHIP_LOST" });
      assert.equal(fixtureStateSchema.parse(access.state.value).value, 0);
      await access.state.update({ value: 1, intent: "text" });
      return { outcome: "complete" };
    };
    assert.equal(
      (await createRuntime(f.options).flow(f.blueprint, "text")).status,
      "completed",
    );
  });

  test("synchronous Step loops yield so event-loop callbacks can run", async () => {
    const f = runtimeFixture();
    let tick = false;
    let calls = 0;
    f.codes.start = () => {
      if (++calls === 1) {
        void setImmediate().then(() => {
          tick = true;
        });
        return { outcome: "retry" };
      }
      assert.equal(tick, true);
      return { outcome: "complete" };
    };
    assert.equal(
      (await createRuntime(f.options).flow(f.blueprint, "text")).status,
      "completed",
    );
  });
});

test("host abort while preparing execution prevents late Run admission and business effects", async () => {
  const fixture = runtimeFixture();
  let ready!: () => void;
  const gate = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const controller = new AbortController();
  const runtime = createRuntime({
    ...fixture.options,
    signal: controller.signal,
    async prepareExecution() {
      await gate;
      return { source: "cli", agentExecutor: "service" };
    },
  });
  const request = runtime.flow(fixture.blueprint, "stop during preparation");
  const stopped = new Error("host closed");
  controller.abort(stopped);
  ready();
  await assert.rejects(request, (error) => error === stopped);
  assert.deepEqual(await runtime.listRuns(), []);
  assert.deepEqual(fixture.events, []);
});

test("exclusive workflows reject concurrent starts and release after completion", async () => {
  const f = runtimeFixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  f.codes.start = async () => {
    entered.resolve();
    await release.promise;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const first = runtime.flow({ ...f.blueprint, exclusive: true }, "first");
  await entered.promise;
  await assert.rejects(runtime.flow(f.blueprint, "conflict"), { code: "BUSY" });
  release.resolve();
  assert.equal((await first).status, "completed");
  assert.equal((await runtime.flow(f.blueprint, "next")).status, "completed");
});
