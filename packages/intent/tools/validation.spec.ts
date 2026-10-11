import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
  JsonValue,
} from "@intloom/workflow-sdk";
import {
  validationStateSchema,
  validationProposalSchema,
  type ValidationState,
} from "../schemas/validation-state.ts";
import { json } from "../src/flow/shared.ts";
import check from "../codes/validation/check.ts";
import { readValidationContext, submitValidation } from "./validation.ts";

function fixture() {
  let state = validationStateSchema.parse({
    id: "RUN-test",
    intent: "exercise submission execution",
    specification: { id: "spec", revision: 1, data: {} },
    solution: { id: "sol", revision: 1, data: {} },
    baseline: null,
    fileSnapshot: { "test.ts": "0".repeat(64) },
    scope: {
      specification: [{ type: "acceptance", ref: "SACC-a" }],
      solution: [],
    },
  });
  const input = validationProposalSchema.parse({
    specification_checks: [
      {
        target: { type: "acceptance", ref: "SACC-a" },
        evidences: [
          {
            id: "VEVD-a",
            method: "code",
            code_path: [{ path: "test.ts", lines: [1] }],
            target_ref: "SACC-a",
            result: "fullfill",
          },
        ],
        result: { status: "verified", reason: "source inspected" },
      },
    ],
    solution_checks: [],
    tests_checks: [],
    code_issues: [],
    findings: [],
  });
  const access: AgentExecutionAccess<JsonValue> = {
    signal: new AbortController().signal,
    state: {
      get value() {
        return json(state);
      },
      create: async () => {
        throw Error("unused");
      },
      update: async (value) => {
        state = validationStateSchema.parse(value);
      },
      clear: async () => {
        throw Error("unused");
      },
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
      write: async () => {
        throw Error("Validation must not write files");
      },
      remove: async () => {
        throw Error("Validation must not remove files");
      },
      run: async () => {
        throw Error("Submission must not rerun commands");
      },
    },
  };
  const item = input.specification_checks[0];
  const evidence = item?.evidences[0];
  const location = evidence?.code_path[0];
  assert.ok(item && evidence && location && access.project);
  return {
    access,
    input,
    item,
    evidence,
    location,
    project: access.project,
    get state() {
      return state;
    },
  };
}

async function submit(...args: Parameters<typeof submitValidation.execute>) {
  return await submitValidation.execute(...args);
}

const rejection = { code: "INVALID_INTENT_STAGE", retryable: false };

test("one report mistake returns safe feedback and one corrected proposal saves", async () => {
  const f = fixture();
  f.location.lines = [200];
  const rejected = await submit(f.input, f.access);
  assert.equal(rejected.saved, false);
  assert.deepEqual(submitValidation.outputSchema.parse(rejected), rejected);
  if (rejected.saved) assert.fail("expected report feedback");
  assert.equal(rejected.attemptsRemaining, 1);
  assert.equal(rejected.feedback.rule, "EVIDENCE_LINE_OUT_OF_RANGE");
  assert.equal(rejected.feedback.path, "test.ts");
  assert.equal(rejected.feedback.requestedLine, 200);
  assert.equal(rejected.feedback.maxLine, 1);
  assert.equal(f.state.proposal, undefined);
  assert.equal(f.state.submissionCount, 1);
  const read = (await readValidationContext.execute(
    {},
    f.access,
  )) as ValidationState;
  assert.deepEqual(read.submissionFeedback, rejected.feedback);
  f.location.lines = [1];
  assert.deepEqual(await submit(f.input, f.access), { saved: true });
  assert.equal(f.state.submissionCount, 2);
  assert.deepEqual(f.state.proposal, f.input);
  assert.equal(f.state.submissionFeedback, undefined);
  await assert.rejects(submit(f.input, f.access), {
    code: "INTENT_BUDGET_EXCEEDED",
  });
});

test("a second invalid report terminates with its original non-retryable error", async () => {
  const f = fixture();
  f.evidence.result = "violated";
  f.item.result.status = "partial";
  const first = await submit(f.input, f.access);
  assert.equal(first.saved, false);
  if (first.saved) assert.fail("expected report feedback");
  assert.equal(first.feedback.rule, "VIOLATION_STATUS_MISMATCH");
  await assert.rejects(submit(f.input, f.access), rejection);
  assert.equal(f.state.submissionCount, 2);
  assert.equal(f.state.proposal, undefined);
  await assert.rejects(submit(f.input, f.access), {
    code: "INTENT_BUDGET_EXCEEDED",
  });
});

test("honest failed, partial and undone reports save without an implementation repair", async () => {
  for (const status of ["failed", "partial", "undone"] as const) {
    const f = fixture();
    const item = f.item;
    item.result.status = status;
    item.evidences =
      status === "undone"
        ? []
        : [
            {
              ...f.evidence,
              result: status === "failed" ? "violated" : "partial",
            },
          ];
    assert.deepEqual(await submit(f.input, f.access), { saved: true });
    assert.equal(
      f.state.proposal?.specification_checks[0]?.result.status,
      status,
    );
    assert.equal(f.state.submissionCount, 1);
  }
});

test("stale bases, code drift, missing initialization and real host failures are never feedback", async () => {
  const stale = fixture();
  const getArtifact = stale.access.storage.getArtifact;
  stale.access.storage.getArtifact = async (...args) => {
    const artifact = await getArtifact(...args);
    assert.ok(artifact);
    return { ...artifact, revision: 2 };
  };
  await assert.rejects(submit(stale.input, stale.access), {
    code: "STALE_INTENT_BASIS",
  });
  assert.equal(stale.state.submissionCount, 0);
  const drift = fixture();
  drift.project.snapshot = async () => ({ "test.ts": "1".repeat(64) });
  await assert.rejects(submit(drift.input, drift.access), {
    code: "STALE_INTENT_BASIS",
  });
  assert.equal(drift.state.submissionCount, 0);
  const uninitialized = fixture();
  await uninitialized.access.state.update(
    json({ id: "RUN-test", intent: "not initialized" }),
  );
  await assert.rejects(
    submit(uninitialized.input, uninitialized.access),
    rejection,
  );
  for (const operation of ["storage", "project", "state"] as const) {
    const f = fixture();
    const error = new LoomError("INVALID_INTENT_STAGE", "actual host failure", {
      retryable: false,
    });
    if (operation === "storage")
      f.access.storage.getArtifact = async () => {
        throw error;
      };
    if (operation === "project")
      f.project.read = async () => {
        throw error;
      };
    if (operation === "state")
      f.access.state.update = async () => {
        throw error;
      };
    await assert.rejects(
      submit(f.input, f.access),
      (observed) => observed === error,
    );
    assert.equal(f.state.submissionCount, 0);
    assert.equal(f.state.submissionFeedback, undefined);
  }
});

test("failed feedback persistence remains a host error and cannot grant a correction", async () => {
  const f = fixture();
  f.input.specification_checks = [];
  const error = Error("state update failed");
  f.access.state.update = async () => {
    throw error;
  };
  await assert.rejects(
    submit(f.input, f.access),
    (observed) => observed === error,
  );
  assert.equal(f.state.submissionCount, 0);
});

test("submission feedback omits private identifiers and paths and cannot modify counters", async () => {
  const f = fixture();
  f.evidence.id = "VEVD-secret-PRIVATE_BODY";
  f.evidence.code_path = [{ path: "secret/PRIVATE_BODY.ts", lines: [1] }];
  const result = await submit(f.input, f.access);
  assert.equal(result.saved, false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_BODY"), false);
  assert.equal(
    JSON.stringify(f.state.submissionFeedback).includes("PRIVATE_BODY"),
    false,
  );
  assert.equal(
    submitValidation.inputSchema.safeParse({ ...f.input, submissionCount: 0 })
      .success,
    false,
  );
  assert.equal(
    submitValidation.inputSchema.safeParse({
      ...f.input,
      submissionFeedback: {},
    }).success,
    false,
  );
});

test("final Code check remains authoritative after successful submission", async () => {
  const f = fixture();
  assert.deepEqual(await submit(f.input, f.access), { saved: true });
  const codeAccess: CodeExecutionAccess<JsonValue> = {
    ...f.access,
    storage: {
      ...f.access.storage,
      commit: async () => {
        throw Error("Check must not commit");
      },
    },
    interaction: {
      askQuestions: async () => {
        throw Error("unused");
      },
      confirm: async () => {
        throw Error("unused");
      },
    },
  };
  assert.deepEqual(await check(null, codeAccess), { outcome: "valid" });
  f.project.snapshot = async () => ({ "test.ts": "1".repeat(64) });
  await assert.rejects(check(null, codeAccess), { code: "STALE_INTENT_BASIS" });
  assert.equal(f.state.submissionCount, 1);
});
