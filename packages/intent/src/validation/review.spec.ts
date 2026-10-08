import assert from "node:assert/strict";
import { test } from "node:test";
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
  await assert.rejects(reviewValidation(access, state), /outside/);
  proposal.specification_checks = [];
  await assert.rejects(reviewValidation(access, state), /exactly one/);
  access.project.snapshot = async () => ({ "test.ts": "1".repeat(64) });
  await assert.rejects(reviewValidation(access, state), /changed during/);
});
