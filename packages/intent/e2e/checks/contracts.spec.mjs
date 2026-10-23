import assert from "node:assert/strict";
import { test } from "node:test";
import { checkContracts } from "./contracts.mjs";
import { checkHistory } from "./history.mjs";
import { digest } from "./shared.mjs";

function fixture(runId = "run-one") {
  const candidate = {
    id: "candidate-one",
    digest: "candidate-digest",
    files: { "app.mjs": "hash" },
  };
  const interaction = {
    id: "confirmation",
    kind: "confirmation",
    answer: { isConfirmed: true },
  };
  const target = {
    id: "target",
    kind: "acceptance",
    entityId: "acceptance",
    definitionDigest: "definition-one",
    persistent: true,
  };
  const execution = {
    id: "receipt",
    kind: "execution",
    candidateRef: candidate.id,
    data: {
      outcome: "exited",
      result: { exitCode: 0, timedOut: false, truncated: false },
    },
  };
  const basis = (stage, data) => ({
    recordRef: `${runId}-${stage}`,
    digest: data.digest,
  });
  const seal = (body) => ({ ...body, digest: digest(body) });
  const common = {
    runId,
    prompt: "Build the example",
    interactions: [interaction],
  };
  const specification = seal({
    ...common,
    baseline: null,
    snapshot: { requirements: [{ id: "req", status: "active" }] },
    approval: { reviewDigest: "review", interactionRef: interaction.id },
    scope: {
      workItems: [{ id: "work", action: "add", requirementRefs: ["req"] }],
      roundCriteria: [],
      coverage: [{ workItemRef: "work", roundCriteriaRefs: [] }],
    },
  });
  const solution = seal({
    ...common,
    baseline: null,
    basis: { specification: basis("specification", specification) },
    snapshot: { objects: [{ id: "object" }] },
    approval: { reviewDigest: "review", interactionRef: interaction.id },
    plan: {
      implementationItems: [{ id: "item", designRefs: ["object"] }],
      verifications: [{ id: "verification" }],
      coverage: [
        {
          workItemRef: "work",
          target: { kind: "acceptance", id: "acceptance" },
          implementationRefs: ["item"],
          verificationRefs: ["verification"],
        },
      ],
    },
    targets: [target],
  });
  const implementation = seal({
    ...common,
    basis: { ...solution.basis, solution: basis("solution", solution) },
    workspace: { baseline: { id: "before" }, candidate },
    submission: {
      candidateRef: candidate.id,
      items: [{ implementationRef: "item" }],
    },
    delivery: { kind: "complete" },
    changes: [{ beforeDigest: null, afterDigest: "hash" }],
    verifications: [{ disposition: "executed" }],
    evidence: [execution],
  });
  const validation = seal({
    ...common,
    basis: {
      ...implementation.basis,
      implementation: basis("implementation", implementation),
    },
    candidate,
    scope: { targets: [target] },
    assessments: [
      {
        targetRef: "target",
        verdict: "passed",
        evidence: [{ evidenceRef: execution.id, relation: "supports" }],
      },
    ],
    evidence: [execution],
    verifications: [{ disposition: "executed" }],
    findings: [],
    findingUpdates: [],
    summary: {
      verdict: "passed",
      counts: { passed: 1, failed: 0, unverified: 0, total: 1 },
    },
  });
  const records = Object.entries({
    specification,
    solution,
    implementation,
    validation,
  }).map(([stageName, data]) => ({
    id: `${runId}-${stageName}`,
    loomName: "intent",
    stageName,
    data,
  }));
  const artifacts = ["specification", "solution", "validation"].map(
    (stageName) => ({
      id: `artifact-${stageName}`,
      loomName: "intent",
      stageName,
      revision: 1,
      data:
        stageName === "validation"
          ? {
              records: [
                { recordRef: `${runId}-validation`, publicationOrder: 1 },
              ],
              latestRound: {
                recordRef: `${runId}-validation`,
                candidateRef: candidate.id,
                verdict: "passed",
              },
              targetIndex: [
                {
                  targetKey: "acceptance:acceptance:definition-one",
                  latestAssessmentRef: `${runId}-validation#assessments/target`,
                },
              ],
              findingIndex: [],
            }
          : records.find((r) => r.stageName === stageName).data.snapshot,
    }),
  );
  return {
    version: 1,
    caseId: "S01",
    round: { id: "create", input: { prompt: common.prompt } },
    run: {
      runId,
      loomName: "intent",
      status: "completed",
      settled: true,
      results: [
        ...records.map((r) => ({
          kind: "record",
          id: r.id,
          stageName: r.stageName,
        })),
        ...artifacts.map((a) => ({
          kind: "artifact",
          id: a.id,
          stageName: a.stageName,
          revision: a.revision,
        })),
      ],
    },
    results: { records, artifacts },
    confirmations: ["specification", "solution"].map((stageName) => ({
      runId,
      stageName,
      confirmed: true,
    })),
    previousRounds: [],
    previousRecords: [],
  };
}
function reseal(record) {
  const { digest: _old, ...body } = record.data;
  record.data.digest = digest(body);
}

test("four-stage oracle requires actual Records, handoffs, approvals and current-candidate evidence", () => {
  const c = fixture();
  checkContracts(c);
  checkHistory(c);
  const missing = structuredClone(c);
  missing.results.records.pop();
  assert.throws(() => checkContracts(missing));
  const broken = structuredClone(c);
  const record = broken.results.records.at(-1);
  record.data.basis.implementation.recordRef = "other-run";
  reseal(record);
  assert.throws(() => checkContracts(broken), /handoff/);
  const stale = structuredClone(c);
  const validation = stale.results.records.at(-1);
  validation.data.evidence[0].candidateRef = "old-candidate";
  reseal(validation);
  assert.throws(() => checkContracts(stale));
  const falsePass = structuredClone(c);
  const failed = falsePass.results.records.at(-1);
  failed.data.evidence[0].data.result.exitCode = 1;
  reseal(failed);
  assert.throws(() => checkContracts(falsePass));
});

test("history oracle rejects rewritten Records and old acceptance substituted for the latest assessment", () => {
  const first = fixture(),
    next = fixture("run-two");
  next.previousRounds = [first];
  next.previousRecords = structuredClone(first.results.records);
  for (const stage of ["specification", "solution"]) {
    const previous = first.results.artifacts.find((a) => a.stageName === stage);
    next.results.records.find((r) => r.stageName === stage).data.baseline = {
      id: previous.id,
      revision: previous.revision,
      data: previous.data,
    };
    next.results.artifacts.find((a) => a.stageName === stage).revision = 2;
  }
  const projection = next.results.artifacts.at(-1).data;
  projection.records.unshift({
    recordRef: "run-one-validation",
    publicationOrder: 1,
  });
  projection.records[1].publicationOrder = 2;
  const validation = next.results.records.at(-1).data;
  validation.assessments[0].verdict = "unverified";
  validation.summary.verdict = "undone";
  projection.latestRound.verdict = "undone";
  checkHistory(next);
  const bad = structuredClone(next);
  bad.previousRecords[0].data.prompt = "rewritten";
  assert.throws(() => checkHistory(bad), /immutable/);
  projection.targetIndex[0].latestAssessmentRef =
    "run-one-validation#assessments/target";
  assert.throws(() => checkHistory(next));
});
