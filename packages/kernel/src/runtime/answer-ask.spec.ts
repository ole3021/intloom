import assert from "node:assert/strict";
import { test } from "node:test";
import { deferred, runtimeFixture } from "../../test/runtime-fixture.ts";
import type { ReadonlyJsonValue } from "../shared/json.ts";
import { createRuntime } from "./create-runtime.ts";
import { answerAsk } from "./answer-ask.ts";
import { createRun } from "./create-run.ts";
import { createRunEntry, waitUntilStable } from "./run-entry.ts";
import { launchRunLoop } from "./run-loop.ts";

test("public answers resume the same Code across successive actions without repeating effects", async (t) => {
  const f = runtimeFixture();
  let effects = 0;
  let continued = 0;
  f.codes.start = async (_input, access) => {
    effects++;
    const first = await access.interaction.confirm("first?");
    assert.equal(first.isConfirmed, true);
    continued++;
    await access.state.update({ value: 1, intent: "text" });
    const second = await access.interaction.confirm("second?");
    assert.equal(second.isConfirmed, false);
    continued++;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const first = await runtime.flow(f.blueprint, "text");
  assert.ok(first.pendingAction);
  assert.equal(continued, 0);
  const second = await runtime.answerAsk(first.runId, first.pendingAction.id, {
    isConfirmed: true,
  });
  assert.equal(second.status, "waiting");
  assert.ok(second.pendingAction);
  assert.notEqual(second.pendingAction.id, first.pendingAction.id);
  assert.equal(continued, 1);
  await assert.rejects(
    runtime.answerAsk(first.runId, first.pendingAction.id, {
      isConfirmed: true,
    }),
    { code: "CONFLICT" },
  );
  assert.deepEqual(await runtime.getRun(first.runId), second);
  const done = await runtime.answerAsk(first.runId, second.pendingAction.id, {
    isConfirmed: false,
  });
  assert.equal(done.status, "completed");
  assert.equal(done.pendingAction, undefined);
  assert.equal(continued, 2);
  assert.equal(effects, 1);
  await assert.rejects(
    runtime.answerAsk(first.runId, second.pendingAction.id, {
      isConfirmed: true,
    }),
    { code: "CONFLICT" },
  );
  assert.deepEqual(await runtime.getRun(first.runId), done);
});

test("invalid confirmation submissions retain the exact action and timestamps", async (t) => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const view = await runtime.flow(f.blueprint, "text");
  assert.ok(view.pendingAction);
  await assert.rejects(
    runtime.answerAsk("missing", view.pendingAction.id, {}),
    {
      code: "NOT_FOUND",
    },
  );
  await assert.rejects(runtime.answerAsk(view.runId, "", {}), {
    code: "INVALID_REQUEST",
  });
  await assert.rejects(runtime.answerAsk(view.runId, "old", {}), {
    code: "CONFLICT",
  });
  for (const answer of [
    null,
    [],
    {},
    { isConfirmed: "yes" },
    { isConfirmed: true, extra: 1 },
  ]) {
    await assert.rejects(
      runtime.answerAsk(view.runId, view.pendingAction.id, answer),
      {
        code: "INVALID_REQUEST",
      },
    );
    assert.deepEqual(await runtime.getRun(view.runId), view);
  }
  assert.equal(
    (
      await runtime.answerAsk(view.runId, view.pendingAction.id, {
        isConfirmed: true,
      })
    ).status,
    "completed",
  );
});

test("question replies match the whole request once, respect skipping, and preserve free text", async (t) => {
  const f = runtimeFixture();
  let received: unknown;
  f.codes.start = async (_input, access) => {
    received = await access.interaction.askQuestions([
      {
        id: "required",
        question: "Required?",
        isSkippable: false,
        options: [{ id: "suggestion", label: "Suggested text" }],
      },
      { id: "optional", question: "Optional?", isSkippable: true },
    ]);
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const view = await runtime.flow(f.blueprint, "text");
  assert.ok(view.pendingAction);
  const valid = {
    questionId: "required",
    isSkipped: false,
    answer: "  custom answer  ",
  };
  const invalid: ReadonlyJsonValue[] = [
    [],
    [valid],
    [valid, valid],
    [valid, { questionId: "unknown", isSkipped: true }],
    [
      { questionId: "required", isSkipped: true },
      { questionId: "optional", isSkipped: true },
    ],
    [
      { questionId: "required", isSkipped: false, answer: " \n " },
      { questionId: "optional", isSkipped: true },
    ],
    { isConfirmed: true },
  ];
  for (const answer of invalid) {
    await assert.rejects(
      runtime.answerAsk(view.runId, view.pendingAction.id, answer),
      {
        code: "INVALID_REQUEST",
      },
    );
    assert.deepEqual(await runtime.getRun(view.runId), view);
    assert.equal(received, undefined);
  }
  const answers = [{ questionId: "optional", isSkipped: true }, valid];
  const next = runtime.answerAsk(view.runId, view.pendingAction.id, answers);
  valid.answer = "caller mutation";
  assert.equal((await next).status, "completed");
  assert.deepEqual(received, [
    { questionId: "optional", isSkipped: true },
    { questionId: "required", isSkipped: false, answer: "  custom answer  " },
  ]);
});

test("duplicate question or per-question option IDs fail before creating an action", async () => {
  for (const duplicateOptions of [false, true]) {
    const f = runtimeFixture();
    const question = {
      id: "question",
      question: "Question?",
      isSkippable: false,
      ...(duplicateOptions
        ? {
            options: [
              { id: "same", label: "A" },
              { id: "same", label: "B" },
            ],
          }
        : {}),
    };
    f.codes.start = async (_input, access) => {
      await access.interaction.askQuestions(
        duplicateOptions ? [question] : [question, question],
      );
      return { outcome: "complete" };
    };
    const view = await createRuntime(f.options).flow(f.blueprint, "text");
    assert.equal(view.status, "failed");
    assert.equal(view.lastError?.code, "STEP_INTERACTION_INVALID");
    assert.equal(view.pendingAction, undefined);
  }
});

test("concurrent answers consume an action only once and do not affect the next question", async (t) => {
  const f = runtimeFixture();
  let answers = 0;
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("first?");
    answers++;
    await access.interaction.confirm("second?");
    answers++;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const view = await runtime.flow(f.blueprint, "text");
  assert.ok(view.pendingAction);
  const results = await Promise.allSettled([
    runtime.answerAsk(view.runId, view.pendingAction.id, { isConfirmed: true }),
    runtime.answerAsk(view.runId, view.pendingAction.id, {
      isConfirmed: false,
    }),
  ]);
  assert.equal(results[0]?.status, "fulfilled");
  assert.equal(results[1]?.status, "rejected");
  if (results[1]?.status === "rejected")
    assert.equal(results[1].reason.code, "CONFLICT");
  assert.equal(answers, 1);
  const next = await runtime.getRun(view.runId);
  assert.equal(next.status, "waiting");
  assert.ok(next.pendingAction);
  assert.notEqual(next.pendingAction.id, view.pendingAction.id);
});

test("an accepted answer waits for stable execution and Code failures become Run failures", async (t) => {
  const f = runtimeFixture();
  const resumed = deferred();
  const release = deferred();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    resumed.resolve();
    await release.promise;
    throw new Error("business failure after answer");
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const view = await runtime.flow(f.blueprint, "text");
  assert.ok(view.pendingAction);
  let returned = false;
  const answer = runtime.answerAsk(view.runId, view.pendingAction.id, {
    isConfirmed: true,
  });
  void answer.then(() => {
    returned = true;
  });
  await resumed.promise;
  assert.equal(returned, false);
  assert.equal((await runtime.getRun(view.runId)).status, "running");
  await assert.rejects(
    runtime.answerAsk(view.runId, view.pendingAction.id, {}),
    {
      code: "CONFLICT",
    },
  );
  release.resolve();
  const failed = await answer;
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError?.code, "STEP_EXECUTION_FAILED");
  assert.equal(failed.pendingAction, undefined);
});

test("answer identities isolate Runs even when they ask the same question", async (t) => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("same question");
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  t.after(() => runtime.cancelAllRuns());
  const a = await runtime.flow(f.blueprint, "A");
  const b = await runtime.flow(f.blueprint, "B");
  assert.ok(a.pendingAction && b.pendingAction);
  await assert.rejects(
    runtime.answerAsk(b.runId, a.pendingAction.id, { isConfirmed: true }),
    {
      code: "CONFLICT",
    },
  );
  assert.equal(
    (
      await runtime.answerAsk(a.runId, a.pendingAction.id, {
        isConfirmed: true,
      })
    ).status,
    "completed",
  );
  assert.deepEqual(await runtime.getRun(b.runId), b);
});

test("answer parsing cannot consume an action stopped by a reentrant input getter", async () => {
  const f = runtimeFixture();
  let continued = false;
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    continued = true;
    return { outcome: "complete" };
  };
  const runtime = createRuntime(f.options);
  const view = await runtime.flow(f.blueprint, "text");
  assert.ok(view.pendingAction);
  await assert.rejects(
    runtime.answerAsk(view.runId, view.pendingAction.id, {
      get isConfirmed() {
        void runtime.cancelRun(view.runId);
        return true;
      },
    }),
    { code: "CONFLICT" },
  );
  assert.equal(
    (await runtime.getRun(view.runId)).lastError?.code,
    "RUN_STOPPED",
  );
  assert.equal(continued, false);
});

test("a broken waiting continuation fails the Run instead of replaying or consuming an answer", async () => {
  const f = runtimeFixture();
  f.codes.start = async (_input, access) => {
    await access.interaction.confirm("continue?");
    return { outcome: "complete" };
  };
  const entry = createRunEntry(f.blueprint, createRun(f.blueprint, "text"));
  const waiting = waitUntilStable(entry);
  launchRunLoop(entry, f.options);
  const task = entry.task;
  const view = await waiting;
  assert.ok(view.pendingAction);
  delete entry.activeCall;
  assert.throws(
    () => answerAsk(entry, view.pendingAction?.id ?? "", { isConfirmed: true }),
    {
      code: "KERNEL_UNAVAILABLE",
    },
  );
  await task;
  assert.equal(entry.state.lastError?.code, "RUN_STATE_INVALID");
  assert.equal(entry.state.pendingAction, undefined);
  assert.equal(entry.reply, undefined);
  assert.equal(entry.observers.size, 0);
  assert.deepEqual(f.events, ["init:first"]);
});
