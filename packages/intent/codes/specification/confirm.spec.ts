import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { saveState } from "../../src/specification/state.ts";
import { submitProposal } from "../../src/specification/proposal.ts";
import confirm from "./confirm.ts";
import finalize from "./finalize.ts";
import check from "./check.ts";
import { emptyArtifact } from "../../src/specification/changes.ts";

import { proposal, ready } from "../../test/specification-fixture.ts";

describe("confirm", () => {
  test("confirmation describes the reviewed candidate while preserving the authoritative snapshot", async () => {
    const baseline = emptyArtifact();
    baseline.constraints.push({
      id: "SCON-storage",
      status: "active",
      description: "Previous storage location",
      record_refs: [],
    });
    const r = await ready(baseline);
    await submitProposal(
      {
        ...proposal,
        changes: [
          {
            target_ref: "SCON-storage",
            reason: "The user specified the storage location",
            patch: [
              {
                op: "test",
                path: "/description",
                value: "Previous storage location",
              },
              {
                op: "replace",
                path: "/description",
                value: "Store tasks only in browser localStorage",
              },
            ],
          },
        ],
      },
      r.access,
    );
    await check(null, r.access);
    const snapshot = structuredClone(r.state?.confirmation?.context);
    assert.ok(snapshot);
    r.access.interaction.confirm = async (context) => {
      assert.match(context, /Specification ready to save/);
      assert.match(context, /Store tasks only in browser localStorage/);
      assert.doesNotMatch(
        context,
        /Previous storage location|baseline|record_refs|patch/,
      );
      assert.deepEqual(r.state?.confirmation?.context, snapshot);
      return { isConfirmed: true };
    };
    assert.deepEqual(await confirm(null, r.access), { outcome: "confirmed" });
    assert.deepEqual(r.state?.confirmation?.context, snapshot);
    assert.equal(r.state?.confirmation?.confirmed, true);
  });
  test("rejected confirmation preserves raw feedback and invalidates snapshot", async () => {
    const r = await ready();
    r.access.interaction.confirm = async () => ({
      isConfirmed: false,
      feedback: "  Export is also required  ",
    });
    assert.deepEqual(await confirm(null, r.access), { outcome: "feedback" });
    assert.equal(r.state?.feedbacks[0]?.content, "  Export is also required  ");
    assert.equal(r.state?.confirmation, undefined);
    await assert.rejects(finalize(null, r.access), /confirmation/);
  });
  test("rejected confirmation asks for missing feedback and preserves the real answer", async () => {
    const r = await ready();
    r.access.interaction.confirm = async () => ({
      isConfirmed: false,
      feedback: "  ",
    });
    r.access.interaction.askQuestions = async (request) => {
      assert.deepEqual(request, [
        {
          id: "confirmation_feedback",
          question: "Describe the changes you need.",
          isSkippable: false,
        },
      ]);
      return [
        {
          questionId: "confirmation_feedback",
          isSkipped: false,
          answer: "  Add export support  ",
        },
      ];
    };
    assert.deepEqual(await confirm(null, r.access), { outcome: "feedback" });
    assert.equal(r.state?.feedbacks[0]?.content, "  Add export support  ");
    assert.equal(r.state?.confirmation, undefined);
  });
  test("affirmative confirmation containing feedback requires a fresh unambiguous authorization", async () => {
    const r = await ready();
    let confirmations = 0;
    r.access.interaction.confirm = async (context) => {
      confirmations++;
      assert.match(context, /^Specification ready to save/);
      assert.doesNotMatch(context, /"baseline"|"changes"/);
      if (confirmations === 1)
        return { isConfirmed: true, feedback: "Further changes are required" };
      assert.match(context, /Further changes are required/);
      assert.equal(r.state?.confirmation?.confirmed, false);
      return { isConfirmed: true };
    };
    assert.deepEqual(await confirm(null, r.access), { outcome: "confirmed" });
    assert.equal(confirmations, 2);
    assert.equal(r.state?.confirmation?.confirmed, true);
  });
  test("feedback supplements cannot authorize a changed State or accept a skipped answer", async () => {
    const r = await ready();
    r.access.interaction.confirm = async () => ({ isConfirmed: false });
    r.access.interaction.askQuestions = async () => [
      { questionId: "confirmation_feedback", isSkipped: true },
    ];
    await assert.rejects(confirm(null, r.access), /required question/);
    assert.deepEqual(r.state?.feedbacks, []);
    r.access.interaction.askQuestions = async () => {
      const state = r.state;
      assert.ok(state);
      state.feedbacks.push({ source: "user", content: "concurrent" });
      await saveState(r.access, state);
      return [
        {
          questionId: "confirmation_feedback",
          isSkipped: false,
          answer: "real reply",
        },
      ];
    };
    await assert.rejects(confirm(null, r.access), {
      code: "STALE_SPECIFICATION_REPLY",
    });
  });
  test("missing interaction capability fails instead of faking a reply", async () => {
    const r = await ready();
    await assert.rejects(
      // @ts-expect-error Deliberately omit the required interaction capability.
      confirm(null, { state: r.access.state, storage: r.access.storage }),
      /must bind/,
    );
    assert.equal(r.state?.confirmation?.confirmed, false);
  });
  test("confirmation reply cannot authorize a concurrently modified State", async () => {
    const r = await ready();
    r.access.interaction.confirm = async () => {
      await submitProposal(proposal, r.access);
      return { isConfirmed: true };
    };
    await assert.rejects(confirm(null, r.access), /State changed/);
    assert.equal(r.state?.confirmation, undefined);
  });
});
