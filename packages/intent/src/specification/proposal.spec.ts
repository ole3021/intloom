import assert from "node:assert/strict";
import { describe, test } from "node:test";
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
    [
      "dropped question history",
      { questions: [] },
      { code: "INVALID_SPECIFICATION", message: /history/ },
    ],
    [
      "duplicate question IDs",
      { questions: [question, question] },
      { code: "INVALID_SPECIFICATION", message: /unique IDs/ },
    ],
    [
      "changed question text",
      { questions: [{ ...question, question: "Replacement question" }] },
      { code: "INVALID_SPECIFICATION", message: /immutable/ },
    ],
    [
      "changed skip permission",
      { questions: [{ ...question, isBlock: false }] },
      { code: "INVALID_SPECIFICATION", message: /immutable/ },
    ],
    [
      "unseen feedback consumption",
      { processedFeedbackCount: 1 },
      { code: "INVALID_SPECIFICATION", message: /feedback count/ },
    ],
  ] as const) {
    test(`rejects ${name} without changing State`, async () => {
      const r = runtime();
      await init(null, r.access);
      const initial = { ...proposal, questions: [question] };
      await submitProposal(initial, r.access);
      const before = r.state;
      await assert.rejects(
        submitProposal({ ...initial, ...update }, r.access),
        error,
      );
      assert.deepEqual(r.state, before);
    });
  }
});
