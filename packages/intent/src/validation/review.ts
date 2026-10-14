import { getLogger, LoomError } from "@intloom/utils";
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
  type ValidationFeedback,
  type ValidationReportRule,
} from "../../schemas/validation-state.ts";
import { passed } from "../implementation/checks.ts";
const prefixes: Record<string, string> = {
  SDOM: "domain",
  SFEA: "feature",
  SREQ: "requirement",
  SACC: "acceptance",
  SCON: "constraint",
  SREL: "relation",
  SDEF: "deferred",
  OAPP: "app",
  OPKG: "package",
  OMOD: "module",
  ORES: "resource",
  OREL: "relation",
  OSCN: "scenario",
  OCON: "concept",
  ODEC: "decision",
  ORISK: "risk",
  ODIAG: "diagram",
};
export function targets(data: unknown, includeRetired = false) {
  const selected: ReturnType<typeof validationTargetSchema.parse>[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = value as Record<string, unknown>;
    if (!includeRetired && item.status === "retired") return;
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
type ValidationRule =
  | ValidationReportRule
  | "INCOMPLETE_EVIDENCE"
  | "PROJECT_CHANGED";
const guidance: Record<ValidationReportRule, string> = {
  SCOPE_CHECK_COUNT:
    "Include exactly one check for each scoped target, including undone targets.",
  CHECK_TARGET_MISMATCH:
    "Copy the target type and reference from the fixed scope.",
  EVIDENCE_IDENTITY_INVALID:
    "Use unique evidence IDs and link each evidence to its check target.",
  EVIDENCE_FILE_MISSING:
    "Cite a concrete file in the fixed snapshot; omit unsupported evidence instead of inventing a location.",
  EVIDENCE_LINE_OUT_OF_RANGE:
    "Read the cited file and use only existing line numbers.",
  HOST_CHECK_MISSING:
    "Use an exact commandResults ID for executed evidence; source inspection uses method code.",
  HOST_CHECK_FAILED:
    "A failed, timed out or truncated command cannot support fullfill evidence.",
  VERIFIED_EVIDENCE_INCONSISTENT:
    "Verified requires at least one evidence and every evidence result to be fullfill; preserve honest gaps.",
  VIOLATION_STATUS_MISMATCH:
    "Any violated evidence requires failed check status; preserve the evidence.",
  TEST_IDENTITY_OR_RANGE_INVALID:
    "Use a unique test ID and an ordered range of existing lines.",
  TEST_TARGET_UNKNOWN: "Link the test only to references in the fixed scope.",
  TEST_STATUS_MISMATCH:
    "Match executed test status to its real commandResults ID; unexecuted tests use not_run.",
  FINDING_ID_DUPLICATE: "Use a unique ID for each finding.",
  FINDING_RANGE_INVALID:
    "Use an ordered range of existing lines for the finding.",
};

/** Only explicit report mistakes may become bounded Tool feedback. */
export class ValidationReportRejected extends LoomError<"INVALID_INTENT_STAGE"> {
  readonly feedback: ValidationFeedback;
  constructor(message: string, feedback: ValidationFeedback) {
    super("INVALID_INTENT_STAGE", message, { retryable: false });
    this.feedback = feedback;
  }
}

type ValidationOwner =
  | { kind: "evidence"; id: string; targetRef: string }
  | { kind: "test"; id: string }
  | { kind: "finding"; id: string }
  | { kind: "code_issue"; index: number };

type ValidationContext = {
  owner?: ValidationOwner;
  scopeGroup?: "specification" | "solution";
  targetRef?: string;
  evidenceId?: string;
  testId?: string;
  findingId?: string;
  path?: string;
  requestedLine?: number | undefined;
  lineStart?: number;
  lineEnd?: number;
  maxLine?: number;
  checkId?: string | undefined;
  expectedCount?: number;
  actualCount?: number;
};

const privateSegment =
  /(?:^|[./_:-])(?:secret|token|apikey|credential|password|bearer)(?:[./_:-]|$)/iu;
const safeId = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u.test(value) &&
  !privateSegment.test(value)
    ? value
    : undefined;
const safePath = (value: string) =>
  value.length <= 160 &&
  /^[A-Za-z0-9._/-]+$/u.test(value) &&
  !value.startsWith("/") &&
  !privateSegment.test(value) &&
  !value
    .split("/")
    .some(
      (part) =>
        part === ".." ||
        part === "." ||
        /^\.env(?:$|\.)|^\.dev\.vars/u.test(part),
    )
    ? value
    : undefined;
const safeCount = (value: number) =>
  Number.isSafeInteger(value) && value >= 0 ? value : undefined;

/** Emit only known rule and bounded identifiers; the original business error remains unchanged. */
function rejectValidation(
  rule: ValidationRule,
  message: string,
  context: ValidationContext = {},
  code: "INVALID_INTENT_STAGE" | "STALE_INTENT_BASIS" = "INVALID_INTENT_STAGE",
): never {
  const owner = context.owner;
  const targetRef =
    context.targetRef ??
    (owner?.kind === "evidence" ? owner.targetRef : undefined);
  const evidenceId =
    context.evidenceId ?? (owner?.kind === "evidence" ? owner.id : undefined);
  const testId =
    context.testId ?? (owner?.kind === "test" ? owner.id : undefined);
  const findingId =
    context.findingId ?? (owner?.kind === "finding" ? owner.id : undefined);
  const diagnostic = {
    ...(context.scopeGroup ? { scopeGroup: context.scopeGroup } : {}),
    ...(targetRef && safeId(targetRef) ? { targetRef } : {}),
    ...(evidenceId && safeId(evidenceId) ? { evidenceId } : {}),
    ...(testId && safeId(testId) ? { testId } : {}),
    ...(findingId && safeId(findingId) ? { findingId } : {}),
    ...(owner?.kind === "code_issue" && safeCount(owner.index) !== undefined
      ? { codeIssueIndex: owner.index }
      : {}),
    ...(context.path && safePath(context.path) ? { path: context.path } : {}),
    ...(context.checkId && safeId(context.checkId)
      ? { checkId: context.checkId }
      : {}),
    ...(context.requestedLine !== undefined &&
    safeCount(context.requestedLine) !== undefined
      ? { requestedLine: context.requestedLine }
      : {}),
    ...(context.lineStart !== undefined &&
    safeCount(context.lineStart) !== undefined
      ? { lineStart: context.lineStart }
      : {}),
    ...(context.lineEnd !== undefined &&
    safeCount(context.lineEnd) !== undefined
      ? { lineEnd: context.lineEnd }
      : {}),
    ...(context.maxLine !== undefined &&
    safeCount(context.maxLine) !== undefined
      ? { maxLine: context.maxLine }
      : {}),
    ...(context.expectedCount !== undefined &&
    safeCount(context.expectedCount) !== undefined
      ? { expectedCount: context.expectedCount }
      : {}),
    ...(context.actualCount !== undefined &&
    safeCount(context.actualCount) !== undefined
      ? { actualCount: context.actualCount }
      : {}),
  };
  getLogger().warn("intent_validation_rejected", { rule, ...diagnostic });
  if (
    code === "INVALID_INTENT_STAGE" &&
    rule !== "INCOMPLETE_EVIDENCE" &&
    rule !== "PROJECT_CHANGED"
  )
    throw new ValidationReportRejected(message, {
      rule,
      message: guidance[rule],
      ...diagnostic,
    });
  fail(message, code);
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
    rejectValidation(
      "INCOMPLETE_EVIDENCE",
      "Validation needs complete initialized evidence.",
    );
  await sameBasis(access, "specification", state.specification);
  await sameBasis(access, "solution", state.solution);
  if (digest(await project(access).snapshot()) !== digest(state.fileSnapshot))
    rejectValidation(
      "PROJECT_CHANGED",
      "Project files changed during validation.",
      {},
      "STALE_INTENT_BASIS",
    );
  const lineCounts = new Map<string, number>();
  const bounded = (value: string, limit: number) =>
    JSON.stringify(value.length > limit ? `${value.slice(0, limit)}…` : value);
  const ownerLabel = (owner: ValidationOwner) =>
    owner.kind === "code_issue"
      ? `code_issue #${owner.index}`
      : `${owner.kind} ${bounded(owner.id, 64)}`;
  async function location(
    path: string,
    lines: readonly number[],
    owner: ValidationOwner,
    range?: { lineStart: number; lineEnd: number },
  ) {
    const requested = range
      ? `range ${range.lineStart}-${range.lineEnd}`
      : `lines [${lines.slice(0, 8).join(",")}${lines.length > 8 ? ",…" : ""}]`;
    const context = `${ownerLabel(owner)}, path ${bounded(path, 160)}, requested ${requested}`;
    const diagnostic = {
      owner,
      path,
      ...(range
        ? { lineStart: range.lineStart, lineEnd: range.lineEnd }
        : { requestedLine: lines[0] }),
    };
    if (!state.fileSnapshot?.[path])
      rejectValidation(
        "EVIDENCE_FILE_MISSING",
        `Evidence file does not exist (${context}, maxLine unavailable).`,
        diagnostic,
      );
    let count = lineCounts.get(path);
    if (count === undefined) {
      count = (await project(access).read(path)).split("\n").length;
      lineCounts.set(path, count);
    }
    const invalidLine = lines.find((line) => line > count);
    if (invalidLine !== undefined)
      rejectValidation(
        "EVIDENCE_LINE_OUT_OF_RANGE",
        `Evidence line is outside the file (${context}, invalidLine ${invalidLine}, maxLine ${count}).`,
        { ...diagnostic, requestedLine: invalidLine, maxLine: count },
      );
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
      rejectValidation(
        "SCOPE_CHECK_COUNT",
        "Every scoped target needs exactly one check, including undone targets.",
        {
          scopeGroup: group,
          expectedCount: required.length,
          actualCount: checks.length,
        },
      );
    for (const check of checks) {
      if (
        !required.some(
          (t) => t.ref === check.target.ref && t.type === check.target.type,
        )
      )
        rejectValidation(
          "CHECK_TARGET_MISMATCH",
          "Check target does not match its scope.",
          {
            scopeGroup: group,
            targetRef: check.target.ref,
          },
        );
      for (const evidence of check.evidences) {
        if (
          evidenceIds.has(evidence.id) ||
          evidence.target_ref !== check.target.ref
        )
          rejectValidation(
            "EVIDENCE_IDENTITY_INVALID",
            "Evidence identity or ownership is invalid.",
            {
              scopeGroup: group,
              targetRef: check.target.ref,
              evidenceId: evidence.id,
            },
          );
        evidenceIds.add(evidence.id);
        for (const path of evidence.code_path)
          await location(path.path, path.lines ?? [], {
            kind: "evidence",
            id: evidence.id,
            targetRef: check.target.ref,
          });
        if (evidence.method !== "code") {
          const result = state.commandResults.find(
            (r) => r.id === evidence.checkId,
          );
          if (!result)
            rejectValidation(
              "HOST_CHECK_MISSING",
              `Evidence ${JSON.stringify(evidence.id.slice(0, 64))} with method ${evidence.method} must reference an existing host command result by checkId. Source inspection uses method code.`,
              {
                scopeGroup: group,
                targetRef: check.target.ref,
                evidenceId: evidence.id,
              },
            );
          if (evidence.result === "fullfill" && !passed(result))
            rejectValidation(
              "HOST_CHECK_FAILED",
              "A failed or incomplete command cannot prove fulfillment.",
              {
                scopeGroup: group,
                targetRef: check.target.ref,
                evidenceId: evidence.id,
                checkId: evidence.checkId,
              },
            );
        }
      }
      if (
        check.result.status === "verified" &&
        (!check.evidences.some((e) => e.result === "fullfill") ||
          check.evidences.some((e) => e.result !== "fullfill"))
      )
        rejectValidation(
          "VERIFIED_EVIDENCE_INCONSISTENT",
          "Verified checks require sufficient, consistent supporting evidence.",
          { scopeGroup: group, targetRef: check.target.ref },
        );
      if (
        check.evidences.some((e) => e.result === "violated") &&
        check.result.status !== "failed"
      )
        rejectValidation(
          "VIOLATION_STATUS_MISMATCH",
          "A confirmed violation requires a failed result.",
          {
            scopeGroup: group,
            targetRef: check.target.ref,
          },
        );
    }
  }
  const allIds = new Set(
    [...state.scope.specification, ...state.scope.solution].map((t) => t.ref),
  );
  const testIds = new Set<string>();
  for (const test of report.tests_checks) {
    if (
      testIds.has(test.test_code_ref.id) ||
      test.test_code_ref.lineEnd < test.test_code_ref.lineStart
    )
      rejectValidation(
        "TEST_IDENTITY_OR_RANGE_INVALID",
        "Invalid test location or identity.",
        {
          testId: test.test_code_ref.id,
          path: test.test_code_ref.path,
          lineStart: test.test_code_ref.lineStart,
          lineEnd: test.test_code_ref.lineEnd,
        },
      );
    await location(
      test.test_code_ref.path,
      [test.test_code_ref.lineStart, test.test_code_ref.lineEnd],
      { kind: "test", id: test.test_code_ref.id },
      test.test_code_ref,
    );
    testIds.add(test.test_code_ref.id);
    for (const ref of test.ttarget_refs)
      if (!allIds.has(ref))
        rejectValidation("TEST_TARGET_UNKNOWN", "Unknown test target.", {
          testId: test.test_code_ref.id,
          targetRef: ref,
        });
    if (test.status !== "not_run") {
      const result = state.commandResults.find((r) => r.id === test.checkId);
      if (
        !result ||
        result.timedOut ||
        result.truncated ||
        (test.status === "passed") !== passed(result)
      )
        rejectValidation(
          "TEST_STATUS_MISMATCH",
          "Test status does not match its host execution.",
          {
            testId: test.test_code_ref.id,
            ...(result ? { checkId: test.checkId } : {}),
          },
        );
    }
  }
  if (new Set(report.findings.map((f) => f.id)).size !== report.findings.length)
    rejectValidation("FINDING_ID_DUPLICATE", "Finding IDs must be unique.");
  for (const [index, issue] of report.code_issues.entries())
    for (const path of issue.code_paths)
      await location(path.path, path.lines ?? [], {
        kind: "code_issue",
        index: index + 1,
      });
  for (const finding of report.findings)
    for (const path of finding.locations) {
      if (path.lineEnd < path.lineStart)
        rejectValidation("FINDING_RANGE_INVALID", "Invalid finding location.", {
          findingId: finding.id,
          path: path.path,
          lineStart: path.lineStart,
          lineEnd: path.lineEnd,
        });
      await location(
        path.path,
        [path.lineStart, path.lineEnd],
        { kind: "finding", id: finding.id },
        path,
      );
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
