import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runtimeFixture, deferred } from "../../test/runtime-fixture.ts";
import type { JsonValue } from "../shared/json.ts";
import { createRun } from "./create-run.ts";
import { answerAsk } from "./answer-ask.ts";
import { cancelRun } from "./cancel-run.ts";
import { createRunEntry, waitUntilStable } from "./run-entry.ts";
import { launchRunLoop } from "./run-loop.ts";

describe("run loop ownership and continuation", () => {
  test("internal continuation resumes the original Code once and removes request observers", async () => {
    const f = runtimeFixture();
    let calls = 0;
    f.codes.start = async (_input, access) => {
      calls++;
      const answer = await access.interaction.confirm("continue?");
      assert.equal(answer.isConfirmed, true);
      await access.state.update({ value: 1, intent: "text" });
      return { outcome: "complete" };
    };
    const entry = createRunEntry(f.blueprint, createRun(f.blueprint, "text"));
    const waiting = waitUntilStable(entry);
    launchRunLoop(entry, f.options);
    const task = entry.task;
    assert.equal((await waiting).status, "waiting");
    assert.equal(entry.observers.size, 0);
    assert.ok(entry.task);
    assert.equal((await waitUntilStable(entry)).status, "waiting");
    assert.ok(entry.state.pendingAction);
    const next = answerAsk(entry, entry.state.pendingAction.id, {
      isConfirmed: true,
    });
    assert.equal((await next).status, "completed");
    await task;
    assert.equal(calls, 1);
    assert.equal(entry.task, undefined);
    assert.equal(entry.activeCall, undefined);
    assert.equal(entry.reply, undefined);
    assert.equal(entry.observers.size, 0);
    assert.deepEqual(entry.stageState.value, { value: 0, intent: "text" });
  });

  test("late execution results and exceptions cannot replace a newer call at the same cursor", async () => {
    for (const fail of [false, true]) {
      const f = runtimeFixture();
      const entered = deferred<void>();
      const release = deferred<void>();
      f.codes.start = async () => {
        entered.resolve();
        await release.promise;
        if (fail) throw new Error("obsolete failure");
        return { outcome: "complete" };
      };
      const entry = createRunEntry(f.blueprint, createRun(f.blueprint, "text"));
      launchRunLoop(entry, f.options);
      const task = entry.task;
      await entered.promise;
      const nextCall = new AbortController();
      entry.activeCall = nextCall;
      release.resolve();
      await task;
      assert.equal(entry.state.status, "running");
      assert.equal(entry.state.cursor.stepName, "start");
      assert.equal(entry.state.lastError, undefined);
      assert.equal(entry.activeCall, nextCall);
      assert.deepEqual(f.events, ["init:first"]);
    }
  });

  test("late initialization cannot commit its seed or overwrite a stopped Run", async () => {
    const f = runtimeFixture();
    const entered = deferred<void>();
    const release = deferred<JsonValue>();
    Object.assign(f.first, {
      initializeState: () => {
        entered.resolve();
        return release.promise;
      },
    });
    const entry = createRunEntry(f.blueprint, createRun(f.blueprint, "text"));
    launchRunLoop(entry, f.options);
    const task = entry.task;
    await entered.promise;
    cancelRun(entry);
    release.resolve({ value: 9, intent: "text" });
    await task;
    assert.equal(entry.state.lastError?.code, "RUN_STOPPED");
    assert.equal(entry.stageState.value, undefined);
    assert.deepEqual(f.events, []);
  });
});
