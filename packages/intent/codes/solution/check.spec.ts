import assert from "node:assert/strict";
import { test } from "node:test";
import type { CodeExecutionAccess, JsonValue } from "@intloom/workflow-sdk";
import { solutionStateSchema } from "../../schemas/solution-state.ts";
import { json } from "../../src/flow/shared.ts";
import check from "./check.ts";

test("Solution Check persists a repeated violation and does not schedule a third Agent", async () => {
  const basis = { id: "spec", revision: 1, data: {} };
  let state = solutionStateSchema.parse({
    id: "RUN-test",
    intent: "design",
    specification: basis,
    baseline: null,
    changes: [
      {
        target_ref: "OAPP-missing",
        reason: "Revise",
        patch: [{ op: "replace", path: "/description", value: "changed" }],
      },
    ],
    checks: [
      { id: "tests", purpose: "tests", command: "node", args: ["--test"] },
    ],
  });
  const access: CodeExecutionAccess<JsonValue> = {
    signal: new AbortController().signal,
    state: {
      get value() {
        return json(state);
      },
      create: async () => {},
      clear: async () => {},
      update: async (value) => {
        state = solutionStateSchema.parse(value);
      },
    },
    storage: {
      getArtifact: async (_flow, stage) =>
        stage === "specification"
          ? {
              ...basis,
              flowName: "intent",
              stageName: stage,
              createdAt: "t",
              updatedAt: "t",
            }
          : undefined,
      getArtifactById: async () => undefined,
      getRecordById: async () => undefined,
      getLatestRecord: async () => undefined,
      listArtifacts: async () => ({ data: [] }),
      listRecords: async () => ({ data: [] }),
      commit: async () => {
        throw new Error("Check must not commit");
      },
    },
    interaction: {
      askQuestions: async () => {
        throw new Error("Check must not ask");
      },
      confirm: async () => {
        throw new Error("Check must not confirm");
      },
    },
  };
  assert.deepEqual(await check(null, access), { outcome: "repair_required" });
  const first = state.feedbacks[0]?.content;
  state.processedFeedbackCount = 1;
  await assert.rejects(check(null, access), { code: "INTENT_REPAIR_STALLED" });
  assert.equal(state.feedbacks.length, 2);
  assert.equal(state.feedbacks[1]?.content, first);
  assert.equal(state.confirmation, undefined);
});
