import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  answerAsk,
  getRun,
  flow,
  cancelRun,
  listRuns,
  type UserAskQuestions,
} from "@intloom/kernel";
import { executionFixture, proposal, pending } from "./execution-fixture.ts";
import type { SpecificationArtifact } from "../schemas/specification-artifact.ts";
import type { SpecificationRecord } from "../schemas/specification-record.ts";

// Interaction and cancellation use one backend; execution.intg.ts covers both storage implementations.
describe("Intent interaction and cancellation", () => {
  test("clarification, stale replies and feedback supplements resume original Code", async (t) => {
    const answer = "  CSV is required  ";
    const feedback = "  Offline export is also required  ";
    const f = await executionFixture(t, "file", {
      decide(state, iteration) {
        const next = proposal(
          state,
          `${state.intent} ${state.questions[0]?.answer ?? ""} ${state.feedbacks.map((item) => item.content).join(" ")}`,
        );
        next.questions =
          iteration === 1
            ? [
                {
                  id: "QST-1",
                  question: "Which export format is required?",
                  options: [{ id: "QST-1:csv", label: "CSV" }],
                  isBlock: true,
                },
              ]
            : next.questions;
        return {
          proposal: next,
          outcome: iteration === 1 ? "clarification_required" : "ready",
        };
      },
    });
    const asking = await flow(
      f.execution,
      "intent",
      "Provide local export support",
    );
    const action = pending(asking, "user_ask_questions", "clarify");
    assert.equal(
      (action.request as UserAskQuestions)[0]?.options?.[0]?.label,
      "CSV",
    );
    await assert.rejects(
      answerAsk(f.execution, asking.runId, action.id, [
        { questionId: "QST-1", isSkipped: true },
      ]),
      { code: "INVALID_REQUEST" },
    );
    assert.deepEqual(await getRun(f.execution, asking.runId), asking);
    const confirming = await answerAsk(f.execution, asking.runId, action.id, [
      { questionId: "QST-1", isSkipped: false, answer },
    ]);
    const confirmAction = pending(
      confirming,
      "user_ask_confirmation",
      "confirm",
    );
    assert.equal(f.reads[1]?.questions[0]?.answer, answer);
    await assert.rejects(answerAsk(f.execution, asking.runId, action.id, []), {
      code: "CONFLICT",
    });
    const ambiguous = await answerAsk(
      f.execution,
      asking.runId,
      confirmAction.id,
      { isConfirmed: true, feedback: "Further changes are required" },
    );
    const explicit = pending(ambiguous, "user_ask_confirmation", "confirm");
    assert.notEqual(explicit.id, confirmAction.id);
    assert.equal(
      f.codeCalls.filter((call) => call.name === "confirm").length,
      1,
    );
    assert.equal(await f.handle.access.getRecordById(asking.runId), undefined);
    const supplement = await answerAsk(f.execution, asking.runId, explicit.id, {
      isConfirmed: false,
    });
    const feedbackAction = pending(supplement, "user_ask_questions", "confirm");
    assert.equal(
      (feedbackAction.request as UserAskQuestions)[0]?.isSkippable,
      false,
    );
    await assert.rejects(
      answerAsk(f.execution, asking.runId, feedbackAction.id, [
        { questionId: "confirmation_feedback", isSkipped: true },
      ]),
      { code: "INVALID_REQUEST" },
    );
    assert.deepEqual(await getRun(f.execution, asking.runId), supplement);
    const revised = await answerAsk(
      f.execution,
      asking.runId,
      feedbackAction.id,
      [
        {
          questionId: "confirmation_feedback",
          isSkipped: false,
          answer: feedback,
        },
      ],
    );
    const revisedAction = pending(revised, "user_ask_confirmation", "confirm");
    assert.equal(f.reads[2]?.feedbacks[0]?.content, feedback);
    assert.equal(f.reads[2]?.questions[0]?.answer, answer);
    const completed = await answerAsk(
      f.execution,
      asking.runId,
      revisedAction.id,
      { isConfirmed: true },
    );
    assert.equal(
      completed.status,
      "completed",
      JSON.stringify(completed.lastError),
    );
    assert.deepEqual(
      f.codeCalls.map((call) => call.name),
      ["init", "clarify", "check", "confirm", "check", "confirm", "finalize"],
    );
    assert.equal(f.agentTasks.length, 3);
    const record = await f.handle.access.getRecordById(asking.runId);
    assert.ok(record);
    const data = record.data as SpecificationRecord;
    assert.equal(data.questions[0]?.answer, answer);
    assert.deepEqual(data.feedbacks, [{ source: "user", content: feedback }]);
    assert.equal((await f.handle.access.listRecords({})).data.length, 1);
    await assert.rejects(
      answerAsk(f.execution, asking.runId, revisedAction.id, {
        isConfirmed: true,
      }),
      { code: "CONFLICT" },
    );
  });

  test("optional skipping with a Deferred reaches confirmation without resolution flags or repairs", async (t) => {
    const f = await executionFixture(t, "file", {
      decide(state, iteration) {
        const next = proposal(state);
        if (iteration === 1)
          next.questions = [
            { id: "QST-1", question: "Choose the theme now?", isBlock: false },
          ];
        if (state.questions[0]?.skipped)
          next.changes.push({
            target_ref: "SDEF-theme",
            reason: "Preserve the nonblocking item skipped by the user",
            patch: [
              {
                op: "add",
                path: "",
                value: {
                  id: "SDEF-theme",
                  status: "active",
                  question: "Choose the theme now?",
                  description: "The theme was not decided in this iteration.",
                  impact_refs: [],
                  record_refs: [],
                },
              },
            ],
          });
        return {
          proposal: next,
          outcome: iteration === 1 ? "clarification_required" : "ready",
        };
      },
    });
    const asking = await flow(f.execution, "intent", "Build a Todo app");
    const action = pending(asking, "user_ask_questions", "clarify");
    const confirming = await answerAsk(f.execution, asking.runId, action.id, [
      { questionId: "QST-1", isSkipped: true },
    ]);
    const confirmation = pending(
      confirming,
      "user_ask_confirmation",
      "confirm",
    );
    assert.equal(f.reads.length, 2);
    assert.equal(f.reads[1]?.questions[0]?.skipped, true);
    assert.equal(f.reads[1]?.questions[0]?.answer, undefined);
    assert.deepEqual(f.reads[1]?.feedbacks, []);
    const completed = await answerAsk(
      f.execution,
      asking.runId,
      confirmation.id,
      {
        isConfirmed: true,
      },
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.runId, asking.runId);
    assert.deepEqual(
      f.codeCalls.map((call) => call.name),
      ["init", "clarify", "check", "confirm", "finalize"],
    );
    const record = await f.handle.access.getRecordById(asking.runId);
    const artifact = await f.handle.access.getArtifact(
      "intent",
      "specification",
    );
    assert.ok(record && artifact);
    assert.deepEqual((record.data as SpecificationRecord).questions, []);
    assert.equal(
      (artifact.data as SpecificationArtifact).deferreds[0]?.question,
      "Choose the theme now?",
    );
  });

  test("an insufficient answer creates a new question and retains the earlier reply", async (t) => {
    const f = await executionFixture(t, "file", {
      decide(state, iteration) {
        const next = proposal(state);
        if (iteration === 1)
          next.questions = [
            {
              id: "QST-1",
              question: "Which export format is required?",
              isBlock: true,
            },
          ];
        if (iteration === 2)
          next.questions.push({
            id: "QST-2",
            question: "Which encoding should CSV use?",
            isBlock: true,
          });
        return {
          proposal: next,
          outcome: iteration < 3 ? "clarification_required" : "ready",
        };
      },
    });
    const first = await flow(f.execution, "intent", "Provide export support");
    const firstAction = pending(first, "user_ask_questions", "clarify");
    const second = await answerAsk(f.execution, first.runId, firstAction.id, [
      { questionId: "QST-1", isSkipped: false, answer: "CSV" },
    ]);
    const secondAction = pending(second, "user_ask_questions", "clarify");
    assert.notEqual(secondAction.id, firstAction.id);
    assert.deepEqual(
      (secondAction.request as UserAskQuestions).map((item) => item.id),
      ["QST-2"],
    );
    const confirming = await answerAsk(
      f.execution,
      first.runId,
      secondAction.id,
      [{ questionId: "QST-2", isSkipped: false, answer: "UTF-8" }],
    );
    const confirmation = pending(
      confirming,
      "user_ask_confirmation",
      "confirm",
    );
    const completed = await answerAsk(
      f.execution,
      first.runId,
      confirmation.id,
      { isConfirmed: true },
    );
    assert.equal(completed.status, "completed");
    const record = await f.handle.access.getRecordById(first.runId);
    assert.ok(record);
    assert.deepEqual(
      (record.data as SpecificationRecord).questions.map((item) => item.answer),
      ["CSV", "UTF-8"],
    );
    assert.equal(
      f.codeCalls.filter((call) => call.name === "clarify").length,
      2,
    );
  });

  test("a missing Deferred repairs the draft without asking the skipped question again", async (t) => {
    const f = await executionFixture(t, "file", {
      decide(state, iteration) {
        const next = proposal(state);
        next.questions =
          iteration === 1
            ? [
                {
                  id: "QST-2",
                  question: "Is remote synchronization required?",
                  isBlock: false,
                },
              ]
            : next.questions;
        if (iteration >= 3)
          next.changes.push({
            target_ref: "SDEF-sync",
            reason: "The user explicitly skipped the question for now",
            patch: [
              {
                op: "add",
                path: "",
                value: {
                  id: "SDEF-sync",
                  status: "active",
                  question: "Is remote synchronization required?",
                  description: "Wait for further user input before deciding.",
                  impact_refs: [],
                  record_refs: [],
                },
              },
            ],
          });
        return { proposal: next, outcome: "ready" };
      },
    });
    const asking = await flow(f.execution, "intent", "Local first");
    const action = pending(asking, "user_ask_questions", "clarify");
    assert.equal((action.request as UserAskQuestions)[0]?.isSkippable, true);
    const confirming = await answerAsk(f.execution, asking.runId, action.id, [
      { questionId: "QST-2", isSkipped: true },
    ]);
    const confirmation = pending(
      confirming,
      "user_ask_confirmation",
      "confirm",
    );
    assert.equal(f.reads.length, 3);
    assert.equal(f.reads[2]?.questions[0]?.skipped, true);
    assert.equal(f.reads[2]?.feedbacks[0]?.source, "check");
    assert.match(f.reads[2]?.feedbacks[0]?.content ?? "", /Deferred/);
    assert.equal(
      (
        await answerAsk(f.execution, asking.runId, confirmation.id, {
          isConfirmed: true,
        })
      ).status,
      "completed",
    );
    const artifact = await f.handle.access.getArtifact(
      "intent",
      "specification",
    );
    const record = await f.handle.access.getRecordById(asking.runId);
    assert.ok(artifact && record);
    assert.deepEqual(
      (artifact.data as SpecificationArtifact).deferreds[0]?.record_refs,
      [asking.runId],
    );
    assert.deepEqual((record.data as SpecificationRecord).questions, []);
    assert.deepEqual(
      f.codeCalls.map((call) => call.name),
      ["init", "check", "clarify", "check", "check", "confirm", "finalize"],
    );
  });

  test("two Runs share one Agent; stopping one preserves the other's answers and commit", async (t) => {
    const f = await executionFixture(t, "file", {
      decide(state, iteration) {
        const next = proposal(
          state,
          `${state.intent}: ${state.questions[0]?.answer ?? ""}`,
        );
        next.questions =
          iteration === 1
            ? [
                {
                  id: "QST-1",
                  question: "Additional requirements",
                  isBlock: true,
                },
              ]
            : next.questions;
        return {
          proposal: next,
          outcome: iteration === 1 ? "clarification_required" : "ready",
        };
      },
    });
    const [a, b] = await Promise.all([
      flow(f.execution, "intent", "Run A"),
      flow(f.execution, "intent", "Run B"),
    ]);
    const actionA = pending(a, "user_ask_questions", "clarify");
    const actionB = pending(b, "user_ask_questions", "clarify");
    assert.equal(Object.keys(f.execution.registries.agents).length, 1);
    assert.equal(new Set(f.reads.map((state) => state.id)).size, 2);
    assert.equal((await listRuns(f.execution)).length, 2);
    await cancelRun(f.execution, a.runId);
    assert.equal(
      (await getRun(f.execution, a.runId)).lastError?.code,
      "RUN_STOPPED",
    );
    await assert.rejects(answerAsk(f.execution, a.runId, actionA.id, []), {
      code: "CONFLICT",
    });
    assert.deepEqual(await getRun(f.execution, b.runId), b);
    const confirming = await answerAsk(f.execution, b.runId, actionB.id, [
      {
        questionId: "QST-1",
        isSkipped: false,
        answer: "An answer belonging only to B",
      },
    ]);
    const confirmation = pending(
      confirming,
      "user_ask_confirmation",
      "confirm",
    );
    assert.equal(
      (
        await answerAsk(f.execution, b.runId, confirmation.id, {
          isConfirmed: true,
        })
      ).status,
      "completed",
    );
    assert.equal(await f.handle.access.getRecordById(a.runId), undefined);
    const record = await f.handle.access.getRecordById(b.runId);
    assert.ok(record);
    assert.equal(
      (record.data as SpecificationRecord).questions[0]?.answer,
      "An answer belonging only to B",
    );
    assert.equal(
      f.codeCalls.filter(
        (call) => call.name === "clarify" && call.runId === b.runId,
      ).length,
      1,
    );
  });

  test("cancelRun during Agent execution rejects late model output and prevents persistence", async (t) => {
    const entered = deferred<string>();
    const gate = deferred<void>();
    const f = await executionFixture(t, "file", {
      async decide(state) {
        entered.resolve(state.id);
        await gate.promise;
        return { proposal: proposal(state), outcome: "ready" };
      },
    });
    try {
      const started = flow(f.execution, "intent", "stop the running Agent");
      const runId = await entered.promise;
      assert.equal((await getRun(f.execution, runId)).status, "running");
      await cancelRun(f.execution, runId);
      const stopped = await started;
      assert.equal(stopped.lastError?.code, "RUN_STOPPED");
      gate.resolve();
      await Promise.allSettled(f.agentTasks);
      await setImmediate();
      assert.deepEqual(await getRun(f.execution, runId), stopped);
      assert.equal(await f.handle.access.getRecordById(runId), undefined);
      assert.equal(
        await f.handle.access.getArtifact("intent", "specification"),
        undefined,
      );
      assert.deepEqual(
        f.codeCalls.map((call) => call.name),
        ["init"],
      );
    } finally {
      gate.resolve();
    }
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((deliver) => {
    resolve = deliver;
  });
  return { promise, resolve };
}
