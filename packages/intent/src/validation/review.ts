import {
  fail,
  objects,
  project,
  sameBasis,
  digest,
  type ReadAccess,
} from "../flow/shared.ts";
import {
  validationStateSchema,
  type ValidationState,
  validationTargetSchema,
} from "../../schemas/validation-state.ts";
import { passed } from "../implementation/checks.ts";
const prefixes: Record<string, string> = {
  SDOM: "domain",
  SFEA: "feature",
  SREQ: "requirement",
  SACC: "acceptance",
  SCON: "constraint",
  SREL: "relation",
  OAPP: "app",
  OPKG: "package",
  OMOD: "module",
  ORES: "resource",
  OREL: "relation",
  OSCN: "scenario",
  OCON: "concept",
  ODEC: "decision",
};
export function targets(data: unknown) {
  const selected: ReturnType<typeof validationTargetSchema.parse>[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = value as Record<string, unknown>;
    if (item.status === "retired") return;
    const ref = item.id;
    if (
      typeof ref === "string" &&
      prefixes[ref.split("-")[0] ?? ""] &&
      !/-(INT|STEP|RULE)-/.test(ref)
    )
      selected.push(
        validationTargetSchema.parse({
          type: prefixes[ref.split("-")[0] ?? ""],
          ref,
        }),
      );
    Object.values(item).forEach(visit);
  }
  objects(data);
  visit(data);
  return selected;
}
export function readValidation(access: ReadAccess) {
  const state = validationStateSchema.parse(access.state.value);
  if (
    !state.specification ||
    !state.solution ||
    !state.fileSnapshot ||
    !state.scope ||
    state.baseline === undefined
  )
    fail("Validation must be initialized.");
  return state;
}
export async function reviewValidation(
  access: ReadAccess,
  state: ValidationState,
) {
  if (
    !state.specification ||
    !state.solution ||
    !state.fileSnapshot ||
    !state.scope ||
    !state.proposal
  )
    fail("Validation needs complete initialized evidence.");
  await sameBasis(access, "specification", state.specification);
  await sameBasis(access, "solution", state.solution);
  if (digest(await project(access).snapshot()) !== digest(state.fileSnapshot))
    fail("Project files changed during validation.", "STALE_INTENT_BASIS");
  const lineCounts = new Map<string, number>();
  async function location(path: string, lines: readonly number[] = []) {
    if (!state.fileSnapshot?.[path])
      fail(`Evidence file does not exist: ${path}`);
    let count = lineCounts.get(path);
    if (count === undefined) {
      count = (await project(access).read(path)).split("\n").length;
      lineCounts.set(path, count);
    }
    if (lines.some((line) => line > count))
      fail(`Evidence line is outside the file: ${path}`);
  }
  const report = state.proposal,
    evidenceIds = new Set<string>();
  for (const group of ["specification", "solution"] as const) {
    const required = state.scope[group],
      checks =
        report[
          group === "specification" ? "specification_checks" : "solution_checks"
        ];
    if (
      checks.length !== required.length ||
      new Set(checks.map((c) => c.target.ref)).size !== required.length
    )
      fail(
        "Every scoped target needs exactly one check, including undone targets.",
      );
    for (const check of checks) {
      if (
        !required.some(
          (t) => t.ref === check.target.ref && t.type === check.target.type,
        )
      )
        fail("Check target does not match its scope.");
      for (const evidence of check.evidences) {
        if (
          evidenceIds.has(evidence.id) ||
          evidence.target_ref !== check.target.ref
        )
          fail("Evidence identity or ownership is invalid.");
        evidenceIds.add(evidence.id);
        for (const path of evidence.code_path)
          await location(path.path, path.lines);
        if (evidence.method !== "code") {
          const result = state.commandResults.find(
            (r) => r.id === evidence.checkId,
          );
          if (!result)
            fail("Executed evidence must reference a host command result.");
          if (evidence.result === "fullfill" && !passed(result))
            fail("A failed or incomplete command cannot prove fulfillment.");
        }
      }
      if (
        check.result.status === "verified" &&
        (!check.evidences.some((e) => e.result === "fullfill") ||
          check.evidences.some((e) => e.result !== "fullfill"))
      )
        fail(
          "Verified checks require sufficient, consistent supporting evidence.",
        );
      if (
        check.evidences.some((e) => e.result === "violated") &&
        check.result.status !== "failed"
      )
        fail("A confirmed violation requires a failed result.");
    }
  }
  const allIds = new Set(
    [...state.scope.specification, ...state.scope.solution].map((t) => t.ref),
  );
  const testIds = new Set<string>();
  for (const test of report.tests_checks) {
    if (
      testIds.has(test.test_code_ref.id) ||
      !state.fileSnapshot[test.test_code_ref.path] ||
      test.test_code_ref.lineEnd < test.test_code_ref.lineStart
    )
      fail("Invalid test location or identity.");
    await location(test.test_code_ref.path, [
      test.test_code_ref.lineStart,
      test.test_code_ref.lineEnd,
    ]);
    testIds.add(test.test_code_ref.id);
    for (const ref of test.ttarget_refs)
      if (!allIds.has(ref)) fail("Unknown test target.");
    if (test.status !== "not_run") {
      const result = state.commandResults.find((r) => r.id === test.checkId);
      if (
        !result ||
        result.timedOut ||
        result.truncated ||
        (test.status === "passed") !== passed(result)
      )
        fail("Test status does not match its host execution.");
    }
  }
  if (new Set(report.findings.map((f) => f.id)).size !== report.findings.length)
    fail("Finding IDs must be unique.");
  for (const issue of report.code_issues)
    for (const path of issue.code_paths) await location(path.path, path.lines);
  for (const finding of report.findings)
    for (const path of finding.locations) {
      if (path.lineEnd < path.lineStart) fail("Invalid finding location.");
      await location(path.path, [path.lineStart, path.lineEnd]);
    }
  return report;
}
export function summarize(state: ValidationState) {
  if (!state.proposal) fail("Missing validation proposal.");
  const count = (
    type: string,
    checks: NonNullable<ValidationState["proposal"]>["specification_checks"],
  ) => {
    const selected = checks.filter((c) => c.target.type === type);
    return {
      type,
      total_count: selected.length,
      verified_count: selected.filter((c) => c.result.status === "verified")
        .length,
      partial_count: selected.filter((c) => c.result.status === "partial")
        .length,
      undone_count: selected.filter((c) => c.result.status === "undone").length,
      failed_count: selected.filter((c) => c.result.status === "failed").length,
    };
  };
  return {
    specification: ["requirement", "acceptance", "constraint", "relation"].map(
      (type) => count(type, state.proposal?.specification_checks ?? []),
    ),
    solution: ["scenario", "concept", "decision"].map((type) =>
      count(type, state.proposal?.solution_checks ?? []),
    ),
  };
}
