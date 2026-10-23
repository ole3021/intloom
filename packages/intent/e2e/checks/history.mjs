import assert from "node:assert/strict";
import { indexed, main } from "./shared.mjs";

export function checkHistory(c) {
  const current = indexed(c, "records"),
    artifacts = indexed(c, "artifacts");
  const oldRecords = c.previousRounds.flatMap((r) => r.results.records);
  assert.equal(c.previousRecords.length, oldRecords.length);
  for (const old of oldRecords)
    assert.deepEqual(
      c.previousRecords.find((r) => r.id === old.id),
      old,
      "historical Record must be immutable",
    );
  const last = c.previousRounds.at(-1);
  for (const stage of ["specification", "solution"]) {
    const previous = last?.results.artifacts.find((a) => a.stageName === stage);
    assert.deepEqual(
      current.get(stage).data.baseline,
      previous
        ? { id: previous.id, revision: previous.revision, data: previous.data }
        : null,
    );
    if (previous) assert.ok(artifacts.get(stage).revision > previous.revision);
  }
  const rounds = [
    ...c.previousRounds.map((r) =>
      r.results.records.find((x) => x.stageName === "validation"),
    ),
    current.get("validation"),
  ];
  const projection = artifacts.get("validation").data;
  assert.deepEqual(
    projection.records,
    rounds.map((r, index) => ({
      recordRef: r.id,
      publicationOrder: index + 1,
    })),
  );
  const latest = rounds.at(-1);
  assert.deepEqual(projection.latestRound, {
    recordRef: latest.id,
    candidateRef: latest.data.candidate.id,
    verdict: latest.data.summary.verdict,
  });
  const targets = new Map(),
    findings = new Map();
  const ref = (record, collection, id) =>
    `${record.id}#${collection}/${encodeURIComponent(id)}`;
  for (const record of rounds) {
    for (const t of record.data.scope.targets)
      if (t.persistent && t.kind !== "round_criterion")
        targets.set(
          `${t.kind}:${t.entityId}:${t.definitionDigest}`,
          ref(record, "assessments", t.id),
        );
    for (const finding of record.data.findings) {
      const value = ref(record, "findings", finding.id);
      findings.set(finding.id, {
        findingRef: finding.id,
        latestAssessmentRef: value,
        lastDefiniteAssessmentRef: value,
      });
    }
    for (const update of record.data.findingUpdates) {
      const previous = findings.get(update.findingRef);
      assert.equal(update.previousAssessmentRef, previous?.latestAssessmentRef);
      const value = ref(record, "findingUpdates", update.findingRef);
      findings.set(update.findingRef, {
        ...previous,
        latestAssessmentRef: value,
        ...(update.outcome === "unverified"
          ? {}
          : { lastDefiniteAssessmentRef: value }),
      });
    }
  }
  assert.deepEqual(
    projection.targetIndex,
    [...targets].map(([targetKey, latestAssessmentRef]) => ({
      targetKey,
      latestAssessmentRef,
    })),
  );
  assert.deepEqual(projection.findingIndex, [...findings.values()]);
  if (c.caseId === "M01" && c.round.id === "adjust") {
    const spec = current.get("specification").data;
    assert.ok(spec.scope.workItems.some((w) => w.action === "adjust"));
    const removed = spec.scope.workItems.filter((w) => w.action === "remove");
    assert.ok(removed.length);
    assert.ok(spec.scope.roundCriteria.length);
    const previous = last.results.artifacts.find(
      (a) => a.stageName === "specification",
    ).data;
    assert.ok(
      removed.some((w) =>
        w.requirementRefs.some(
          (id) =>
            previous.requirements.some(
              (r) => r.id === id && r.status === "active",
            ) &&
            spec.snapshot.requirements.some(
              (r) => r.id === id && r.status === "retired",
            ),
        ),
      ),
      "retire a previously active requirement",
    );
  }
}
await main(import.meta.url, checkHistory);
