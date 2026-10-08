import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runtime } from "../../test/runtime.ts";
import { saveState } from "../../src/specification/state.ts";
import { submitProposal } from "../../src/specification/proposal.ts";
import { hasUserResponse } from "../../src/specification/questions.ts";
import init from "./init.ts";
import clarify from "./clarify.ts";

import { question, proposal } from "../../test/specification-fixture.ts";

describe("clarify", () => {
  test("clarify records the exact reply without an Agent-owned resolution flag", async () => {
    const r = runtime();
    await init(null, r.access);
    await submitProposal({ ...proposal, questions: [question] }, r.access);
    r.access.interaction.askQuestions = async (request) => {
      assert.equal(request[0]?.isSkippable, false);
      return [
        {
          questionId: "QST-1",
          isSkipped: false,
          answer: "  CSV is required  ",
        },
      ];
    };
    await clarify(null, r.access);
    assert.equal(r.state?.questions[0]?.answer, "  CSV is required  ");
    const answered = r.state?.questions[0];
    assert.ok(answered);
    assert.equal(hasUserResponse(answered), true);
    await submitProposal(
      {
        ...proposal,
        questions: [question],
      },
      r.access,
    );
    assert.equal(r.state?.questions[0]?.answer, "  CSV is required  ");
    assert.equal(r.state?.questions[0]?.isBlock, true);
  });
  test("clarify asks only new questions after earlier answers and skips", async () => {
    const r = runtime();
    await init(null, r.access);
    const optional = { ...question, id: "QST-2", isBlock: false };
    await submitProposal(
      { ...proposal, questions: [question, optional] },
      r.access,
    );
    r.access.interaction.askQuestions = async () => [
      { questionId: question.id, isSkipped: false, answer: "CSV" },
      { questionId: optional.id, isSkipped: true },
    ];
    await clarify(null, r.access);
    const followup = {
      ...question,
      id: "QST-3",
      question: "Which CSV encoding must be supported?",
    };
    await submitProposal(
      { ...proposal, questions: [question, optional, followup] },
      r.access,
    );
    r.access.interaction.askQuestions = async (request) => {
      assert.deepEqual(
        request.map((item) => item.id),
        [followup.id],
      );
      assert.equal(request[0]?.isSkippable, false);
      return [{ questionId: followup.id, isSkipped: false, answer: "UTF-8" }];
    };
    await clarify(null, r.access);
    assert.equal(r.state?.questions[0]?.answer, "CSV");
    assert.equal(r.state?.questions[1]?.skipped, true);
    assert.equal(r.state?.questions[1]?.answer, undefined);
    assert.equal(r.state?.questions[2]?.answer, "UTF-8");
  });
  for (const [label, reply] of [
    ["unknown", [{ questionId: "QST-2", isSkipped: false, answer: "x" }]],
    ["missing", []],
    [
      "duplicate",
      [
        { questionId: "QST-1", isSkipped: false, answer: "x" },
        { questionId: "QST-1", isSkipped: false, answer: "x" },
      ],
    ],
    ["blocking skip", [{ questionId: "QST-1", isSkipped: true }]],
  ] as const)
    test(`clarify rejects ${label} replies without changing State`, async () => {
      const r = runtime();
      await init(null, r.access);
      await submitProposal({ ...proposal, questions: [question] }, r.access);
      const before = r.state;
      r.access.interaction.askQuestions = async () => reply;
      await assert.rejects(clarify(null, r.access), {
        code: "INVALID_SPECIFICATION",
      });
      assert.deepEqual(r.state, before);
    });
  test("clarify rejects State changes during interaction", async () => {
    const r = runtime();
    await init(null, r.access);
    await submitProposal({ ...proposal, questions: [question] }, r.access);
    r.access.interaction.askQuestions = async () => {
      const state = r.state;
      assert.ok(state);
      state.feedbacks.push({ source: "user", content: "concurrent" });
      await saveState(r.access, state);
      return [{ questionId: "QST-1", isSkipped: false, answer: "x" }];
    };
    await assert.rejects(clarify(null, r.access), /State changed/);
    assert.equal(r.state?.questions[0]?.answer, undefined);
  });
});
