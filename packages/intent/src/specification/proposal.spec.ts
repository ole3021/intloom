import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as z from "zod";
import { runtime } from "../../test/runtime.ts";
import { submitProposal } from "./proposal.ts";
import init from "../../codes/specification/init.ts";

import { question, proposal } from "../../test/specification-fixture.ts";

describe("submitProposal", () => {
  for (const [name, update, error] of [
    [
      "injected answer",
      { questions: [{ ...question, answer: "fake" }] },
      { name: "ZodError" },
    ],
    ["duplicate question IDs", { questions: [question, question] }, /unique/u],
    [
      "changed question text",
      { questions: [{ ...question, question: "Replacement question" }] },
      /immutable/u,
    ],
    [
      "changed skip permission",
      { questions: [{ ...question, isBlock: false }] },
      /immutable/u,
    ],
    [
      "unseen feedback consumption",
      { processedFeedbackCount: 1 },
      /expectedFeedbackCount/u,
    ],
  ] as const) {
    test(`rejects ${name} without changing State`, async () => {
      const r = runtime();
      await init(null, r.access);
      const initial = { ...proposal, questions: [question] };
      await submitProposal(initial, r.access);
      const before = r.state;
      if (error instanceof RegExp) {
        const result = await submitProposal(
          { ...initial, ...update },
          r.access,
        );
        assert.equal(result.saved, false);
        if (result.saved) assert.fail("Expected correction feedback");
        assert.match(result.feedback.issues.join(" "), error);
        assert.deepEqual(r.state, { ...before, proposalCount: 2 });
      } else {
        await assert.rejects(
          submitProposal({ ...initial, ...update }, r.access),
          error,
        );
        assert.deepEqual(r.state, before);
      }
    });
  }

  test("Code preserves answered history when the next draft submits only new questions", async () => {
    const r = runtime();
    await init(null, r.access);
    await submitProposal({ ...proposal, questions: [question] }, r.access);
    const answered = { ...question, answer: "Actual human reply" };
    await r.access.state.update(
      z.json().parse({ ...r.state, questions: [answered] }),
    );
    assert.deepEqual(await submitProposal(proposal, r.access), { saved: true });
    assert.deepEqual(r.state?.questions, [answered]);
    const followup = {
      ...question,
      id: "QST-2",
      question: "Which export format?",
    };
    await submitProposal({ ...proposal, questions: [followup] }, r.access);
    assert.deepEqual(r.state?.questions, [answered, followup]);
    // Compatible cumulative callers may still repeat exactly the original content.
    await submitProposal(
      { ...proposal, questions: [question, followup] },
      r.access,
    );
    assert.deepEqual(r.state?.questions, [answered, followup]);
  });

  test("invalid proposals remain bounded and do not swallow State failures", async () => {
    const r = runtime();
    await init(null, r.access);
    const invalid = { ...proposal, processedFeedbackCount: 1 };
    for (let i = 0; i < 12; i++)
      assert.equal((await submitProposal(invalid, r.access)).saved, false);
    await assert.rejects(submitProposal(invalid, r.access), /proposal limit/u);
    const broken = runtime();
    await init(null, broken.access);
    broken.access.state.update = async () => {
      throw new Error("State unavailable");
    };
    await assert.rejects(
      submitProposal(invalid, broken.access),
      /State unavailable/u,
    );
  });
});
