import { userAskConfirmationSchema } from "@intloom/loom-sdk";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runtime,
  requirements,
  analysis,
  scope,
  runId,
} from "../../../test/runtime.ts";
import { prepare, check, confirm, commit, checkScope } from "./steps.ts";
import { edit, analyze, submit, readState } from "./actions.ts";
import { checkSpecification } from "./rules.ts";
import { recordId } from "../../../src/storage.ts";
import { specificationRecordSchema } from "../schema/record.ts";

test("analyze and draft have separate capabilities; batch IDs resolve atomically with optional Domain", async () => {
  const f = runtime("specification");
  await prepare(f.access);
  let s = readState(f.access);
  const edits = [
    {
      collection: "features" as const,
      value: {
        id: "$feature",
        name: "Greeting",
        description: "Greeting feature",
        status: "active" as const,
      },
      reason: "Requested",
    },
    {
      collection: "requirements" as const,
      value: {
        id: "$requirement",
        featureRef: "$feature",
        description: "Greet names",
        status: "active" as const,
      },
      reason: "Requested",
    },
    {
      collection: "acceptances" as const,
      value: {
        id: "$acceptance",
        requirementRef: "$requirement",
        description: "Returns greeting",
        status: "active" as const,
      },
      reason: "Verifiable",
    },
  ];
  assert.equal(
    (await edit({ revision: s.revision, edits }, f.access)).saved,
    false,
  );
  await analyze({ revision: s.revision, analysis }, f.access);
  await checkScope(f.access);
  s = readState(f.access);
  const first = await edit({ revision: s.revision, edits }, f.access);
  assert.equal(first.saved, true);
  s = readState(f.access);
  assert.ok(s.draft);
  assert.ok(s.aliases.$feature);
  assert.equal(s.draft.domains.length, 0);
  assert.equal(s.draft.requirements[0]?.featureRef, s.aliases.$feature);
  const before = f.value();
  assert.equal(
    (
      await edit(
        {
          revision: s.revision,
          edits: [
            {
              collection: "requirements",
              value: {
                id: "$bad",
                featureRef: "$missing",
                description: "bad",
                status: "active",
              },
              reason: "bad",
            },
          ],
        },
        f.access,
      )
    ).saved,
    false,
  );
  assert.deepEqual(f.value(), before);
  assert.equal(
    (await edit({ revision: s.revision - 1, edits }, f.access)).saved,
    false,
  );
});

test("zero requirement change retains explicit scope and full immutable snapshot", async () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
    scope,
  });
  checkSpecification(readState(f.access));
  await check(f.access);
  f.replies.push({ isConfirmed: true });
  await confirm(f.access);
  await commit(f.access);
  const record = specificationRecordSchema.parse(
    f.records.get(recordId(runId, "specification"))?.data,
  );
  assert.deepEqual(record.snapshot, requirements);
  assert.equal(record.edits.length, 0);
  assert.equal(record.prompt, "  Fix greeting\n");
  assert.equal(record.scope.workItems.length, 1);
});

test("confirmation feedback and stale review never authorize publication", async () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
    scope,
  });
  await check(f.access);
  f.replies.push({ isConfirmed: true, feedback: "Change the target" });
  assert.equal((await confirm(f.access)).outcome, "feedback");
  await assert.rejects(commit(f.access), /confirmation/);
  await check(f.access);
  const s = readState(f.access);
  assert.ok(s.scope);
  s.scope.excluded.push("new exclusion");
  await f.set(s);
  await assert.rejects(confirm(f.access), /stale/);
});

test("committed Record survives cleanup failure and the original commit is idempotent", async () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
    scope,
  });
  await check(f.access);
  f.replies.push({ isConfirmed: true });
  await confirm(f.access);
  f.flags.failClear = true;
  await assert.rejects(commit(f.access), /clear failed/);
  assert.equal(f.records.size, 1);
  f.flags.failClear = false;
  await commit(f.access);
  assert.equal(f.records.size, 1);
  assert.equal(f.value(), undefined);
});

test("removal needs round-specific completion criteria; unmet questions block check", () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
    scope,
  });
  const s = readState(f.access);
  const work = s.scope?.workItems[0];
  assert.ok(work);
  work.action = "remove";
  assert.throws(() => checkSpecification(s), /round-specific/);
  work.action = "fix";
  s.questions = [{ key: "q", question: "What should happen?" }];
  assert.throws(() => checkSpecification(s), /unanswered/);
});

test("round identities are Code-owned and cannot reuse an artifact's alias", async () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
  });
  let s = readState(f.access);
  assert.equal(
    (await submit({ revision: s.revision, scope }, f.access)).saved,
    false,
  );
  const proposal = structuredClone(scope);
  const work = proposal.workItems[0];
  const coverage = proposal.coverage[0];
  assert.ok(work);
  assert.ok(coverage);
  work.id = "$work";
  coverage.workItemRef = "$work";
  assert.equal(
    (await submit({ revision: s.revision, scope: proposal }, f.access)).saved,
    true,
  );
  s = readState(f.access);
  assert.ok(s.scope);
  const savedWork = s.scope.workItems[0];
  assert.ok(savedWork);
  assert.match(savedWork.id, /^WORK-/);
  assert.equal(
    (await submit({ revision: s.revision, scope: s.scope }, f.access)).saved,
    true,
  );
});

test("confirmation recovery uses the saved request and rejects another reply", async () => {
  const f = runtime("specification", {
    task: "draft",
    baseline: null,
    draft: requirements,
    analysis,
    scope,
  });
  await check(f.access);
  await assert.rejects(confirm(f.access), /No fabricated user reply/);
  const pending = readState(f.access).pendingInteraction;
  assert.ok(pending);
  await assert.rejects(
    confirm(f.access, {
      actionId: "host-confirmation",
      kind: "user_ask_confirmation",
      request: userAskConfirmationSchema.parse({ context: "different review" }),
      answer: { isConfirmed: true },
    }),
    /different request/,
  );
  await confirm(f.access, {
    actionId: "host-confirmation",
    kind: "user_ask_confirmation",
    request: userAskConfirmationSchema.parse(pending.request),
    answer: { isConfirmed: true },
  });
  await commit(f.access);
  assert.equal(f.records.size, 1);
});
