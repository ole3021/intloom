import { userAskQuestionsSchema } from "@intloom/loom-sdk";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runtime,
  specification,
  solution,
  implementation,
  runId,
} from "../../../test/runtime.ts";
import { prepare, verify, check, resolve, commit } from "./steps.ts";
import { readState, submit } from "./actions.ts";
import { summary, checkAssessment } from "./rules.ts";
import { recordId } from "../../../src/storage.ts";
import { validationRecordSchema } from "../schema/record.ts";
import { validationArtifactSchema } from "../schema/artifact.ts";
import type { AssessmentSubmission } from "../schema/submission.ts";
async function fixture() {
  const f = runtime("validation");
  await f.seed("specification", specification());
  await f.seed("solution", solution());
  await f.seed("implementation", implementation(f.candidate()));
  await prepare(f.access);
  return f;
}
function report(
  s: ReturnType<typeof readState>,
  verdict: "passed" | "failed" | "unverified",
): AssessmentSubmission {
  const receipt = s.evidence.find((e) => e.kind === "execution");
  return {
    revision: s.revision,
    candidateRef: s.candidate!.id,
    kind: "ready",
    findings: [],
    findingUpdates: [],
    assessments: s.targets.map((t) => ({
      targetRef: t.id,
      verdict,
      explanation: "Interpret the actual fixture evidence",
      evidence: receipt
        ? [
            {
              evidenceRef: receipt.id,
              relation:
                verdict === "passed"
                  ? ("supports" as const)
                  : verdict === "failed"
                    ? ("contradicts" as const)
                    : ("context" as const),
              explanation: "Fixture proof",
            },
          ]
        : [],
      limitations: [],
      missingEvidence:
        verdict === "unverified" ? ["Runtime observation is missing"] : [],
    })),
  };
}

test("overall results distinguish failed, partial, undone and empty scope", () => {
  const a = {
    targetRef: "a",
    explanation: "x",
    evidence: [],
    limitations: [],
    missingEvidence: [],
  };
  assert.equal(
    summary([
      { ...a, verdict: "failed" },
      { ...a, targetRef: "b", verdict: "unverified" },
    ]).verdict,
    "failed",
  );
  assert.equal(
    summary([
      { ...a, verdict: "passed" },
      { ...a, targetRef: "b", verdict: "unverified" },
    ]).verdict,
    "partial",
  );
  assert.equal(summary([{ ...a, verdict: "unverified" }]).verdict, "undone");
  assert.equal(summary([]).verdict, "undone");
});
test("Validation independently executes both-stage checks and publishes a negative Record", async () => {
  const f = await fixture();
  f.receipts.push({
    exitCode: 1,
    stdout: "Assertion failed: greeting is wrong",
  });
  await verify(f.access);
  assert.equal(f.flags.executions, 1);
  const s = readState(f.access);
  const input = report(s, "failed");
  assert.equal((await submit(input, f.access)).saved, true);
  assert.equal((await check(f.access)).outcome, "ready");
  await commit(f.access);
  const r = validationRecordSchema.parse(
    f.records.get(recordId(runId, "validation"))!.data,
  );
  assert.equal(r.summary.verdict, "failed");
  assert.equal(
    r.basis.implementation.recordRef,
    recordId(runId, "implementation"),
  );
  const artifact = validationArtifactSchema.parse(
    [...f.artifacts.values()][0]!.data,
  );
  assert.equal(artifact.records.length, 1);
  assert.equal(artifact.latestRound!.verdict, "failed");
});
test("missing or unsuccessful evidence cannot support a passed judgment", async () => {
  const f = await fixture();
  f.receipts.push({ exitCode: 127, stderr: "command unavailable" });
  await verify(f.access);
  const s = readState(f.access);
  assert.equal((await submit(report(s, "passed"), f.access)).saved, false);
  assert.equal((await submit(report(s, "unverified"), f.access)).saved, true);
  assert.equal((await check(f.access)).outcome, "needs_input");
});
test("no target disappears with a partial upstream delivery", async () => {
  const f = await fixture();
  const s = readState(f.access);
  const input = report(s, "unverified");
  input.assessments = [];
  assert.throws(() => checkAssessment(s, input, true), /Every required target/);
  assert.equal(s.targets.length, solution().targets.length);
});
test("supplementary requests remain queued across draft replacement and duplicate submission", async () => {
  const f = await fixture();
  await verify(f.access);
  let s = readState(f.access);
  const base = report(s, "unverified");
  const request = {
    key: "extra",
    targetRefs: [s.targets[0]!.id],
    purpose: "Additional observation",
    evidenceGap: "Runtime observation missing",
    method: { kind: "command" as const, command: "node", args: ["--version"] },
    preconditions: [],
    expectedEvidence: "Runtime version",
  };
  const first = {
    ...base,
    kind: "needs_evidence" as const,
    requests: [request],
  };
  assert.equal((await submit(first, f.access)).saved, true);
  s = readState(f.access);
  assert.equal(
    (await submit({ ...first, revision: s.revision }, f.access)).saved,
    true,
  );
  s = readState(f.access);
  assert.equal(
    s.verifications.filter((v) => v.origin === "supplementary").length,
    1,
  );
  assert.equal((await submit(report(s, "unverified"), f.access)).saved, true);
  assert.equal((await check(f.access)).outcome, "verify");
});
test("explicit stop binds exact unfinished work and does not approve acceptance", async () => {
  const f = await fixture();
  let s = readState(f.access);
  s.task = "assess";
  s.stopRequested = true;
  await f.set(s);
  f.replies.push([
    {
      questionId: "collection_action",
      isSkipped: false,
      answer: "stop_collection",
    },
  ]);
  assert.equal((await resolve(f.access)).outcome, "assess");
  s = readState(f.access);
  assert.equal(s.collectionDecisions.length, 1);
  assert.equal(s.verifications[0]!.disposition, "stopped");
  assert.equal((await submit(report(s, "unverified"), f.access)).saved, true);
  assert.equal((await check(f.access)).outcome, "ready");
  await commit(f.access);
  const record = validationRecordSchema.parse(
    f.records.get(recordId(runId, "validation"))!.data,
  );
  assert.equal(record.summary.verdict, "undone");
  assert.equal(record.collectionDecisions[0]!.verificationRefs[0], "VERIFY-a");
});
test("candidate drift blocks publication instead of becoming an undone report", async () => {
  const f = await fixture();
  await verify(f.access);
  const s = readState(f.access);
  await submit(report(s, "passed"), f.access);
  await check(f.access);
  f.files["greet.mjs"] = "new product version";
  await assert.rejects(commit(f.access), /fixed candidate/);
  assert.equal(f.records.has(recordId(runId, "validation")), false);
});

test("final assessment must account for relevant verification receipts even with alternative evidence", async () => {
  const f = await fixture();
  f.receipts.push({ exitCode: 1, stdout: "failed" });
  await verify(f.access);
  const s = readState(f.access),
    input = report(s, "unverified");
  input.assessments[0]!.evidence = [];
  assert.throws(() => checkAssessment(s, input, true), /latest receipt/);
});

test("collection continuation can recover the second information request", async () => {
  const f = await fixture();
  await verify(f.access);
  let s = readState(f.access);
  s.questions = [
    { key: "observation", question: "What did the actual runtime display?" },
  ];
  await f.set(s);
  f.replies.push([
    {
      questionId: "collection_action",
      isSkipped: false,
      answer: "continue_collection",
    },
  ]);
  await assert.rejects(resolve(f.access), /No fabricated user reply/);
  s = readState(f.access);
  assert.equal(s.resolutionChoice, "continue_collection");
  await resolve(f.access, {
    actionId: "host-questions",
    kind: "user_ask_questions",
    request: userAskQuestionsSchema.parse(s.pendingInteraction!.request),
    answer: [
      {
        questionId: "observation",
        isSkipped: false,
        answer: "The greeting was incorrect.",
      },
    ],
  });
  s = readState(f.access);
  assert.equal(s.questions.length, 0);
  assert.equal(s.task, "assess");
  assert.equal(s.interactions.length, 2);
});

test("unverified final gaps need a scoped user decision even after commands complete", async () => {
  const f = await fixture();
  await verify(f.access);
  let s = readState(f.access);
  await submit(report(s, "unverified"), f.access);
  assert.equal((await check(f.access)).outcome, "needs_input");
  f.replies.push([
    {
      questionId: "collection_action",
      isSkipped: false,
      answer: "stop_collection",
    },
  ]);
  await resolve(f.access);
  s = readState(f.access);
  assert.equal(s.collectionDecisions[0]!.verificationRefs.length, 0);
  assert.equal(s.collectionDecisions[0]!.evidenceGapRefs.length, 1);
  await submit(report(s, "unverified"), f.access);
  assert.equal((await check(f.access)).outcome, "ready");
});
