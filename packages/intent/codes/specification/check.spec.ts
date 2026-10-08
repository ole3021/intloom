import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as z from "zod";
import { runtime } from "../../test/runtime.ts";
import { emptyArtifact } from "../../src/specification/changes.ts";
import { submitProposal } from "../../src/specification/proposal.ts";
import init from "./init.ts";
import check from "./check.ts";
import clarify from "./clarify.ts";

import { question, proposal, ready } from "../../test/specification-fixture.ts";

describe("check", () => {
  test("an answered blocking question is ready without clearing its skip policy", async () => {
    const r = runtime();
    await init(null, r.access);
    await submitProposal({ ...proposal, questions: [question] }, r.access);
    assert.deepEqual(await check(null, r.access), {
      outcome: "clarification_required",
    });
    r.access.interaction.askQuestions = async () => [
      { questionId: question.id, isSkipped: false, answer: "CSV is required" },
    ];
    await clarify(null, r.access);
    await submitProposal({ ...proposal, questions: [question] }, r.access);
    assert.deepEqual(await check(null, r.access), { outcome: "ready" });
    assert.equal(r.state?.questions[0]?.isBlock, true);
    assert.equal(
      r.state?.confirmation?.context.questions[0]?.answer,
      "CSV is required",
    );
  });
  test("check returns real diagnostics and does not prepare confirmation on invalid patches", async () => {
    const r = runtime();
    await init(null, r.access);
    await submitProposal(
      {
        ...proposal,
        changes: [
          {
            target_ref: "SCON-x",
            reason: "change",
            patch: [{ op: "replace", path: "/description", value: "x" }],
          },
        ],
      },
      r.access,
    );
    assert.deepEqual(await check(null, r.access), {
      outcome: "repair_required",
    });
    assert.equal(r.state?.feedbacks[0]?.source, "check");
    assert.equal(r.state?.confirmation, undefined);
  });
  test("check refreshes a changed baseline and requires another analysis", async () => {
    const r = await ready();
    r.setArtifact({
      id: "ART-new",
      revision: 1,
      flowName: "intent",
      stageName: "specification",
      data: z.json().parse(emptyArtifact()),
      createdAt: "t",
      updatedAt: "t",
    });
    assert.deepEqual(await check(null, r.access), {
      outcome: "repair_required",
    });
    assert.equal(r.state?.baseline?.artifactId, "ART-new");
    assert.equal(r.state?.confirmation, undefined);
  });
  test("optional skipped questions require a Deferred change before confirmation", async () => {
    const r = runtime();
    await init(null, r.access);
    const optional = { ...question, isBlock: false };
    await submitProposal({ ...proposal, questions: [optional] }, r.access);
    r.access.interaction.askQuestions = async () => [
      { questionId: question.id, isSkipped: true },
    ];
    await clarify(null, r.access);
    await submitProposal({ ...proposal, questions: [optional] }, r.access);
    assert.deepEqual(await check(null, r.access), {
      outcome: "repair_required",
    });
    assert.match(r.state?.feedbacks[0]?.content ?? "", /Deferred/);
    await submitProposal(
      {
        ...proposal,
        processedFeedbackCount: 1,
        questions: [optional],
        changes: [
          {
            target_ref: "SDEF-later",
            reason: "The nonblocking item remains undecided",
            patch: [
              {
                op: "add",
                path: "",
                value: {
                  id: "SDEF-later",
                  status: "active",
                  question: question.question,
                  description: "Preserve the pending item for this iteration",
                  impact_refs: [],
                  record_refs: [],
                },
              },
            ],
          },
        ],
      },
      r.access,
    );
    assert.deepEqual(await check(null, r.access), { outcome: "ready" });
    assert.equal(r.state?.confirmation?.context.questions.length, 0);
  });
});
