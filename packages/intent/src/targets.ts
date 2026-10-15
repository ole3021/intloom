import type { SpecificationRecord } from "../stages/specification/schema/record.ts";
import type { SolutionArtifact } from "../stages/solution/schema/artifact.ts";
import type { Plan } from "../stages/solution/schema/submission.ts";
import type { Target } from "./schema/verification.ts";
import { digest, json } from "./json.ts";
import { recordId } from "./storage.ts";
import { fail } from "./errors.ts";
export function specificationTargets(record: SpecificationRecord): Target[] {
  const targets = new Map<string, Target>();
  function add(
    kind: Target["kind"],
    id: string,
    statement: string,
    context: unknown,
    persistent: boolean,
  ) {
    const value = {
      id: `${kind}:${id}`,
      kind,
      entityId: id,
      statement,
      context: json(context),
      persistent,
      sourceRef: {
        recordRef: recordId(record.runId, "specification"),
        objectRef: id,
      },
      definitionDigest: digest({ kind, statement, context }),
    };
    targets.set(value.id, value);
  }
  for (const coverage of record.scope.coverage) {
    for (const id of coverage.acceptanceRefs) {
      const acceptance = record.snapshot.acceptances.find((a) => a.id === id);
      if (!acceptance) fail("Missing acceptance.");
      const requirement = record.snapshot.requirements.find(
        (r) => r.id === acceptance.requirementRef,
      )!;
      const feature = record.snapshot.features.find(
        (f) => f.id === requirement.featureRef,
      )!;
      add(
        "acceptance",
        id,
        acceptance.description,
        { requirement: requirement.description, feature: feature.description },
        true,
      );
    }
    for (const id of coverage.roundCriteriaRefs)
      add(
        "round_criterion",
        id,
        record.scope.roundCriteria.find((c) => c.id === id)!.description,
        { runId: record.runId },
        false,
      );
    for (const id of coverage.constraintRefs)
      add(
        "engineering_constraint",
        id,
        record.snapshot.constraints.find((c) => c.id === id)!.description,
        {},
        true,
      );
  }
  return [...targets.values()];
}
export function solutionTargets(
  spec: SpecificationRecord,
  snapshot: SolutionArtifact,
  plan: Plan,
): Target[] {
  const targets = specificationTargets(spec);
  const designRefs = new Set(
    plan.implementationItems.flatMap((i) => i.designRefs),
  );
  for (const constraint of snapshot.constraints.filter(
    (c) =>
      c.status === "active" && c.designRefs.some((ref) => designRefs.has(ref)),
  )) {
    const context = constraint.designRefs.map((ref) =>
      snapshot.objects.find((o) => o.id === ref),
    );
    targets.push({
      id: `design_constraint:${constraint.id}`,
      kind: "design_constraint",
      entityId: constraint.id,
      statement: constraint.description,
      context: json(context),
      persistent: true,
      sourceRef: {
        recordRef: recordId(spec.runId, "solution"),
        objectRef: constraint.id,
      },
      definitionDigest: digest({ statement: constraint.description, context }),
    });
  }
  for (const item of plan.engineeringTargets)
    targets.push({
      id: `engineering_constraint:${item.id}`,
      kind: "engineering_constraint",
      entityId: item.id,
      statement: item.description,
      context: {},
      persistent: false,
      sourceRef: {
        recordRef: recordId(spec.runId, "solution"),
        objectRef: item.id,
      },
      definitionDigest: digest(item.description),
    });
  return targets;
}
