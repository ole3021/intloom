import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  initializeProject,
  createEffector,
  flow,
  getRun,
  answerAsk,
} from "@intloom/kernel";
import { executionFixture, proposal, pending } from "./execution-fixture.ts";

for (const backend of ["file", "sqlite"] as const) {
  test(`${backend}: compiled Intent restores clarification, confirmation, feedback and reconfirmation without repeating model calls`, async (t) => {
    const f = await executionFixture(t, backend, {
      recovery: true,
      decide(state) {
        return {
          proposal: {
            ...proposal(state),
            questions: [
              { id: "QST-1", question: "Which region?", isBlock: true },
            ],
          },
          outcome: state.questions[0]?.answer
            ? "ready"
            : "clarification_required",
        };
      },
    });
    let execution = f.execution;
    t.after(() => execution.runtime.suspend());
    async function restart() {
      await execution.runtime.suspend();
      execution = await initializeProject(f.root, {
        runtimeDirectory: join(f.root, ".intloom/runtime"),
        storage: f.handle.access,
        effector: createEffector(),
      });
    }
    const original = await flow(
      execution,
      "intent",
      "Preserve this requirement across host restarts",
    );
    let action = pending(original, "user_ask_questions", "clarify");
    await restart();
    assert.deepEqual(await getRun(execution, original.runId), original);
    let run = await answerAsk(execution, original.runId, action.id, [
      { questionId: "QST-1", isSkipped: false, answer: "China" },
    ]);
    action = pending(run, "user_ask_confirmation", "confirm");
    await restart();
    assert.deepEqual(await getRun(execution, original.runId), run);
    run = await answerAsk(execution, original.runId, action.id, {
      isConfirmed: false,
    });
    action = pending(run, "user_ask_questions", "confirm");
    await restart();
    assert.deepEqual(await getRun(execution, original.runId), run);
    run = await answerAsk(execution, original.runId, action.id, [
      {
        questionId: "confirmation_feedback",
        isSkipped: false,
        answer: "Keep the complete original requirement",
      },
    ]);
    action = pending(run, "user_ask_confirmation", "confirm");
    await restart();
    run = await answerAsk(execution, original.runId, action.id, {
      isConfirmed: true,
      feedback: "Please confirm the scope again",
    });
    action = pending(run, "user_ask_confirmation", "confirm");
    await restart();
    assert.deepEqual(await getRun(execution, original.runId), run);
    run = await answerAsk(execution, original.runId, action.id, {
      isConfirmed: true,
    });
    assert.equal(run.status, "completed", JSON.stringify(run.lastError));
    assert.equal(f.reads.length, 3);
    const records = await f.handle.access.listRecords({});
    assert.equal(records.data.length, 1);
    assert.equal(records.data[0]?.id, original.runId);
    const artifact = await f.handle.access.getArtifact(
      "intent",
      "specification",
    );
    assert.ok(artifact);
    await execution.runtime.suspend();
    await f.handle.dispose();
    const reopened = await f.open();
    try {
      assert.deepEqual(
        await reopened.access.getArtifactById(artifact.id),
        artifact,
      );
      assert.deepEqual(
        await reopened.access.getRecordById(original.runId),
        records.data[0],
      );
    } finally {
      await reopened.dispose();
    }
  });
}
