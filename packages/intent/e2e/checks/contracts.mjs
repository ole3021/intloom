import assert from "node:assert/strict";
import { approval, digest, indexed, main } from "./shared.mjs";

export function checkContracts(c) {
  assert.equal(c.version, 1);
  assert.equal(c.run.loomName, "intent");
  assert.equal(c.run.status, "completed");
  assert.equal(c.run.settled, true);
  const records = indexed(c, "records"),
    artifacts = indexed(c, "artifacts");
  assert.deepEqual([...records.keys()].sort(), [
    "implementation",
    "solution",
    "specification",
    "validation",
  ]);
  assert.deepEqual([...artifacts.keys()].sort(), [
    "solution",
    "specification",
    "validation",
  ]);
  for (const [stage, stored] of records) {
    assert.equal(stored.loomName, "intent");
    assert.equal(stored.data.runId, c.run.runId);
    assert.equal(stored.data.prompt, c.round.input.prompt);
    const { digest: actual, ...body } = stored.data;
    assert.equal(actual, digest(body), `${stage} Record digest`);
    assert.ok(
      c.run.results.some(
        (r) =>
          r.kind === "record" && r.id === stored.id && r.stageName === stage,
      ),
    );
  }
  for (const [stage, stored] of artifacts) {
    assert.equal(stored.loomName, "intent");
    assert.ok(
      c.run.results.some(
        (r) =>
          r.kind === "artifact" &&
          r.id === stored.id &&
          r.stageName === stage &&
          r.revision === stored.revision,
      ),
    );
  }
  const spec = records.get("specification").data,
    solution = records.get("solution").data;
  const impl = records.get("implementation").data,
    validation = records.get("validation").data;
  for (const stage of ["specification", "solution"]) {
    const record = records.get(stage).data;
    assert.deepEqual(
      record.snapshot,
      artifacts.get(stage).data,
      `${stage} full snapshot`,
    );
    approval(record);
    assert.ok(
      c.confirmations.some(
        (x) => x.runId === c.run.runId && x.stageName === stage && x.confirmed,
      ),
      `${stage} public confirmation receipt`,
    );
  }
  for (const [downstream, upstream] of [
    [solution, "specification"],
    [impl, "specification"],
    [impl, "solution"],
    [validation, "specification"],
    [validation, "solution"],
    [validation, "implementation"],
  ]) {
    const actual = records.get(upstream);
    assert.deepEqual(
      downstream.basis[upstream],
      { recordRef: actual.id, digest: actual.data.digest },
      `same-Run ${upstream} handoff`,
    );
  }
  for (const work of spec.scope.workItems) {
    assert.ok(
      work.requirementRefs.every((id) =>
        spec.snapshot.requirements.some((r) => r.id === id),
      ),
    );
    const coverage = spec.scope.coverage.filter(
      (x) => x.workItemRef === work.id,
    );
    assert.ok(coverage.length);
    if (work.action === "remove")
      assert.ok(
        coverage.some((x) => x.roundCriteriaRefs.length > 0),
        "removal needs round criteria",
      );
    assert.ok(
      solution.plan.coverage.some((x) => x.workItemRef === work.id),
      "solution covers every work item",
    );
  }
  for (const row of solution.plan.coverage) {
    assert.ok(spec.scope.workItems.some((x) => x.id === row.workItemRef));
    assert.ok(
      row.implementationRefs.length &&
        row.implementationRefs.every((id) =>
          solution.plan.implementationItems.some((x) => x.id === id),
        ),
    );
    assert.ok(
      row.verificationRefs.length &&
        row.verificationRefs.every((id) =>
          solution.plan.verifications.some((x) => x.id === id),
        ),
    );
    assert.ok(
      solution.targets.some(
        (t) => t.kind === row.target.kind && t.entityId === row.target.id,
      ),
    );
  }
  for (const item of solution.plan.implementationItems) {
    assert.ok(
      item.designRefs.every((id) =>
        solution.snapshot.objects.some((x) => x.id === id),
      ),
    );
    assert.ok(
      impl.submission.items.some((x) => x.implementationRef === item.id),
    );
  }
  assert.equal(impl.submission.candidateRef, impl.workspace.candidate.id);
  assert.deepEqual(validation.candidate, impl.workspace.candidate);
  assert.equal(
    impl.delivery.kind,
    "complete",
    "S01/M01 do not authorize partial delivery",
  );
  assert.ok(
    impl.changes.length > 0,
    "these feature cases require actual changes",
  );
  assert.ok(impl.changes.some((x) => x.beforeDigest !== x.afterDigest));
  for (const stage of [impl, validation]) {
    assert.ok(
      stage.evidence.some(
        (e) =>
          e.kind === "execution" &&
          e.data.outcome === "exited" &&
          e.data.result.exitCode === 0,
      ),
      "independent host execution receipts",
    );
    assert.ok(
      stage.verifications.every(
        (v) =>
          !["pending", "executing", "awaiting_observation"].includes(
            v.disposition,
          ),
      ),
    );
  }
  assert.deepEqual(validation.scope.targets, solution.targets);
  assert.equal(
    new Set(validation.assessments.map((a) => a.targetRef)).size,
    validation.scope.targets.length,
  );
  for (const target of validation.scope.targets) {
    const assessment = validation.assessments.find(
      (a) => a.targetRef === target.id,
    );
    assert.ok(assessment, "every acceptance target has a conclusion");
    if (assessment.verdict === "passed") {
      const supports = assessment.evidence.filter(
        (e) => e.relation === "supports",
      );
      assert.ok(supports.length, "passed requires positive evidence");
      for (const use of supports) {
        const source = validation.evidence.find(
          (e) => e.id === use.evidenceRef,
        );
        assert.ok(source, "evidence reference resolves");
        assert.equal(source.candidateRef, validation.candidate.id);
        assert.ok(
          !["historical_result", "project_write"].includes(source.kind),
        );
        if (source.kind === "execution") {
          assert.equal(source.data.outcome, "exited");
          assert.equal(source.data.result.exitCode, 0);
          assert.equal(source.data.result.timedOut, false);
          assert.equal(source.data.result.truncated, false);
        }
      }
    }
  }
  assert.equal(
    validation.summary.verdict,
    "passed",
    "S01/M01 expect evidence-backed full acceptance",
  );
  assert.ok(validation.assessments.every((a) => a.verdict === "passed"));
  assert.equal(
    validation.summary.counts.total,
    validation.scope.targets.length,
  );
  assert.equal(
    validation.summary.counts.passed,
    validation.scope.targets.length,
  );
  assert.equal(validation.summary.counts.failed, 0);
  assert.equal(validation.summary.counts.unverified, 0);
}
await main(import.meta.url, checkContracts);
