import assert from "node:assert/strict";
import { test } from "node:test";
import { silentLogger, withLogger, type LogFields } from "@intloom/utils";
import { targets } from "./review.ts";
test("validation scope excludes retired subtrees and includes active acceptance", () => {
  assert.deepEqual(
    targets({
      requirements: [
        {
          id: "SREQ-old",
          status: "retired",
          acceptances: [{ id: "SACC-old" }],
        },
        {
          id: "SREQ-live",
          status: "active",
          acceptances: [{ id: "SACC-live" }],
        },
      ],
    }),
    [
      { type: "requirement", ref: "SREQ-live" },
      { type: "acceptance", ref: "SACC-live" },
    ],
  );
});

import type { ReadAccess } from "../flow/shared.ts";
import { reviewValidation, summarize } from "./review.ts";
import { validationStateSchema } from "../../schemas/validation-state.ts";
function fixture() {
  const basis = { id: "spec", revision: 1, data: {} };
  const state = validationStateSchema.parse({
    id: "RUN-test",
    intent: "todo",
    specification: basis,
    solution: { ...basis, id: "sol" },
    baseline: null,
    fileSnapshot: { "test.ts": "0".repeat(64) },
    scope: {
      specification: [{ type: "acceptance", ref: "SACC-a" }],
      solution: [],
    },
    commandResults: [
      {
        id: "test",
        purpose: "test",
        command: { command: "node", args: [] },
        exitCode: 0,
        stdout: "passed",
        stderr: "",
        timedOut: false,
        truncated: false,
      },
    ],
    proposal: {
      specification_checks: [
        {
          target: { type: "acceptance", ref: "SACC-a" },
          evidences: [
            {
              id: "VEVD-a",
              method: "test",
              code_path: [{ path: "test.ts", lines: [1] }],
              target_ref: "SACC-a",
              result: "fullfill",
              checkId: "test",
            },
          ],
          result: { status: "verified", reason: "asserted" },
        },
      ],
      solution_checks: [],
      tests_checks: [],
      findings: [],
      code_issues: [],
    },
  });
  const access: ReadAccess = {
    signal: new AbortController().signal,
    state: {
      value: null,
      create: async () => {},
      update: async () => {},
      clear: async () => {},
    },
    storage: {
      getArtifact: async (_flow, stage) => ({
        id: stage === "specification" ? "spec" : "sol",
        flowName: "intent",
        stageName: stage,
        revision: 1,
        data: {},
        createdAt: "t",
        updatedAt: "t",
      }),
      getArtifactById: async () => undefined,
      getRecordById: async () => undefined,
      getLatestRecord: async () => undefined,
      listArtifacts: async () => ({ data: [] }),
      listRecords: async () => ({ data: [] }),
    },
    project: {
      snapshot: async () => ({ "test.ts": "0".repeat(64) }),
      read: async () => "assert(true);",
      write: async () => {},
      remove: async () => {},
      run: async () => {
        throw Error("unused");
      },
    },
  };
  return { state, access };
}
function diagnosticLog() {
  const rows: { event: string; fields: LogFields }[] = [];
  const logger = {
    ...silentLogger,
    warn(event: string, fields: LogFields = {}) {
      rows.push({ event, fields });
    },
  };
  return {
    rows,
    run<T>(operation: () => T): T {
      return withLogger(logger, operation);
    },
  };
}

test("validation rejects fabricated success, absent coverage, invalid locations and code drift", async () => {
  const { state, access } = fixture();
  await reviewValidation(access, state);
  assert.equal(
    summarize(state).specification.find((c) => c.type === "acceptance")
      ?.verified_count,
    1,
  );
  const result = state.commandResults[0];
  const proposal = state.proposal;
  const location =
    proposal?.specification_checks[0]?.evidences[0]?.code_path[0];
  assert.ok(result && proposal && location && access.project);
  result.exitCode = 1;
  await assert.rejects(reviewValidation(access, state), /cannot prove/);
  result.exitCode = 0;
  location.lines = [200];
  await assert.rejects(
    reviewValidation(access, state),
    /evidence "VEVD-a", path "test\.ts", requested lines \[200\], invalidLine 200, maxLine 1/,
  );
  proposal.specification_checks = [];
  await assert.rejects(reviewValidation(access, state), /exactly one/);
  access.project.snapshot = async () => ({ "test.ts": "1".repeat(64) });
  await assert.rejects(reviewValidation(access, state), /changed during/);
});

test("source inspection uses code; executed analysis needs a real host result", async () => {
  const { state, access } = fixture();
  const evidence = state.proposal?.specification_checks[0]?.evidences[0];
  assert.ok(evidence);
  evidence.method = "code";
  delete evidence.checkId;
  await reviewValidation(access, state);
  evidence.method = "static_analysis";
  await assert.rejects(
    reviewValidation(access, state),
    /VEVD-a.*static_analysis.*checkId/,
  );
  evidence.checkId = "invented";
  await assert.rejects(
    reviewValidation(access, state),
    /existing host command/,
  );
  evidence.checkId = "test";
  await reviewValidation(access, state);
});

test("validation locates out-of-range test and finding lines without changing valid reports", async () => {
  const { state, access } = fixture();
  const proposal = state.proposal;
  assert.ok(proposal);
  proposal.tests_checks.push({
    test_code_ref: {
      id: "VTCD-3",
      path: "test.ts",
      lineStart: 1,
      lineEnd: 100,
    },
    ttarget_refs: ["SACC-a"],
    status: "not_run",
  });
  await assert.rejects(reviewValidation(access, state), (error) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, "INVALID_INTENT_STAGE");
    assert.match(
      error.message,
      /test "VTCD-3", path "test\.ts", requested range 1-100, invalidLine 100, maxLine 1/,
    );
    return true;
  });
  const testRef = proposal.tests_checks[0]?.test_code_ref;
  assert.ok(testRef);
  testRef.lineEnd = 1;
  await reviewValidation(access, state);

  proposal.findings.push({
    id: "VFND-1",
    status: "confirmed",
    description: "Observed failure",
    locations: [{ path: "test.ts", lineStart: 1, lineEnd: 100 }],
    severity_level: "medium",
  });
  await assert.rejects(reviewValidation(access, state), (error) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, "INVALID_INTENT_STAGE");
    assert.match(
      error.message,
      /finding "VFND-1", path "test\.ts", requested range 1-100, invalidLine 100, maxLine 1/,
    );
    return true;
  });
  const findingPath = proposal.findings[0]?.locations[0];
  assert.ok(findingPath);
  findingPath.path = "missing.ts";
  await assert.rejects(reviewValidation(access, state), (error) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, "INVALID_INTENT_STAGE");
    assert.match(
      error.message,
      /finding "VFND-1", path "missing\.ts", requested range 1-100, maxLine unavailable/,
    );
    return true;
  });
  findingPath.path = "test.ts";
  findingPath.lineEnd = 1;
  await reviewValidation(access, state);

  proposal.code_issues.push({
    code_paths: [{ path: "test.ts", lines: [100] }],
    reason: "Needs review",
    needRefactor: false,
  });
  await assert.rejects(
    reviewValidation(access, state),
    /code_issue #1, path "test\.ts", requested lines \[100\], invalidLine 100, maxLine 1/,
  );
  const issuePath = proposal.code_issues[0]?.code_paths[0];
  assert.ok(issuePath);
  issuePath.lines = [1];
  await reviewValidation(access, state);
});

test("validation location diagnostics escape and bound submitted identifiers", async () => {
  const { state, access } = fixture();
  const evidence = state.proposal?.specification_checks[0]?.evidences[0];
  assert.ok(evidence);
  evidence.id = `VEVD-\n${"x".repeat(200)}`;
  evidence.code_path = [
    { path: `missing"\n${"y".repeat(200)}.ts`, lines: [100] },
  ];
  await assert.rejects(reviewValidation(access, state), (error) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, "INVALID_INTENT_STAGE");
    assert.equal(error.message.includes("\n"), false);
    assert.ok(error.message.includes("\\n"));
    assert.ok(error.message.includes('\\"'));
    assert.equal(error.message.includes("x".repeat(100)), false);
    assert.equal(error.message.includes("y".repeat(180)), false);
    assert.match(error.message, /maxLine unavailable/);
    return true;
  });
});

test("validation logs fixed file and line rules while preserving business errors", async () => {
  const { state, access } = fixture();
  const log = diagnosticLog();
  await log.run(() => reviewValidation(access, state));
  assert.deepEqual(log.rows, []);
  const path =
    state.proposal?.specification_checks[0]?.evidences[0]?.code_path[0];
  assert.ok(path);
  path.path = "test";
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    (error) => {
      assert.ok(
        error instanceof Error && "code" in error && "retryable" in error,
      );
      assert.equal(error.code, "INVALID_INTENT_STAGE");
      assert.equal(error.retryable, false);
      assert.match(error.message, /Evidence file does not exist.*path "test"/);
      return true;
    },
  );
  assert.deepEqual(log.rows[0], {
    event: "intent_validation_rejected",
    fields: {
      rule: "EVIDENCE_FILE_MISSING",
      targetRef: "SACC-a",
      evidenceId: "VEVD-a",
      path: "test",
      requestedLine: 1,
    },
  });
  path.path = "test.ts";
  path.lines = [200];
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    /invalidLine 200, maxLine 1/,
  );
  assert.deepEqual(log.rows[1], {
    event: "intent_validation_rejected",
    fields: {
      rule: "EVIDENCE_LINE_OUT_OF_RANGE",
      targetRef: "SACC-a",
      evidenceId: "VEVD-a",
      path: "test.ts",
      requestedLine: 200,
      maxLine: 1,
    },
  });
});

test("validation logs host and scope rules with only verified context", async () => {
  const { state, access } = fixture();
  const log = diagnosticLog();
  const proposal = state.proposal;
  const evidence = proposal?.specification_checks[0]?.evidences[0];
  assert.ok(proposal && evidence);
  evidence.method = "static_analysis";
  evidence.checkId = "invented";
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    /existing host command result/,
  );
  assert.deepEqual(log.rows[0]?.fields, {
    rule: "HOST_CHECK_MISSING",
    scopeGroup: "specification",
    targetRef: "SACC-a",
    evidenceId: "VEVD-a",
  });
  evidence.checkId = "test";
  const hostResult = state.commandResults[0];
  assert.ok(hostResult);
  hostResult.exitCode = 1;
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    /cannot prove fulfillment/,
  );
  assert.deepEqual(log.rows[1]?.fields, {
    rule: "HOST_CHECK_FAILED",
    scopeGroup: "specification",
    targetRef: "SACC-a",
    evidenceId: "VEVD-a",
    checkId: "test",
  });
  proposal.specification_checks = [];
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    /exactly one/,
  );
  assert.deepEqual(log.rows[2]?.fields, {
    rule: "SCOPE_CHECK_COUNT",
    scopeGroup: "specification",
    expectedCount: 1,
    actualCount: 0,
  });
});

test("validation omits unsafe identifiers and paths from warning fields", async () => {
  const { state, access } = fixture();
  const log = diagnosticLog();
  const evidence = state.proposal?.specification_checks[0]?.evidences[0];
  assert.ok(evidence);
  evidence.id = "VEVD-secret-PRIVATE_CREDENTIAL_BODY";
  evidence.code_path = [
    { path: "secret/PRIVATE_CREDENTIAL_BODY.ts", lines: [1] },
  ];
  await assert.rejects(
    log.run(() => reviewValidation(access, state)),
    /Evidence file does not exist/,
  );
  assert.deepEqual(log.rows[0]?.fields, {
    rule: "EVIDENCE_FILE_MISSING",
    targetRef: "SACC-a",
    requestedLine: 1,
  });
  assert.equal(
    JSON.stringify(log.rows).includes("PRIVATE_CREDENTIAL_BODY"),
    false,
  );
});

test("validation omits absolute, traversal, control and environment paths", async () => {
  for (const unsafe of [
    "/absolute.ts",
    "../private.ts",
    "bad\n.ts",
    ".env.local",
  ]) {
    const { state, access } = fixture();
    const log = diagnosticLog();
    const evidence = state.proposal?.specification_checks[0]?.evidences[0];
    assert.ok(evidence);
    evidence.code_path = [{ path: unsafe, lines: [1] }];
    await assert.rejects(
      log.run(() => reviewValidation(access, state)),
      /Evidence file does not exist/,
    );
    assert.equal(log.rows[0]?.fields.rule, "EVIDENCE_FILE_MISSING");
    assert.equal(log.rows[0]?.fields.path, undefined);
    assert.equal(JSON.stringify(log.rows).includes(unsafe), false);
  }
});
