import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  CodeExecutionAccess,
  JsonValue,
  StoredArtifact,
  StoredRecord,
} from "@intloom/workflow-sdk";
import { solutionStateSchema } from "../../schemas/solution-state.ts";
import { digest, json } from "../../src/flow/shared.ts";
import finalize from "./finalize.ts";
test("Solution commit followed by clear failure reuses the same Record", async () => {
  const specification: StoredArtifact = {
    id: "spec",
    flowName: "intent",
    stageName: "specification",
    revision: 1,
    data: {},
    createdAt: "t",
    updatedAt: "t",
  };
  const state = solutionStateSchema.parse({
    id: "RUN-test",
    intent: "unchanged",
    specification: { id: "spec", revision: 1, data: {} },
    baseline: null,
    checks: [{ id: "test", purpose: "test", command: "node", args: [] }],
  });
  state.confirmation = { digest: digest(state), confirmed: true };
  let value: JsonValue | undefined = json(state),
    artifact: StoredArtifact | undefined,
    record: StoredRecord | undefined,
    failClear = true,
    commits = 0;
  const access: CodeExecutionAccess<JsonValue> = {
    signal: new AbortController().signal,
    state: {
      get value() {
        return value;
      },
      create: async (next) => {
        value = next;
      },
      update: async (next) => {
        value = next;
      },
      clear: async () => {
        if (failClear) throw Error("clear failed");
        value = undefined;
      },
    },
    interaction: {
      confirm: async () => ({ isConfirmed: true }),
      askQuestions: async () => [],
    },
    storage: {
      getArtifact: async (_flow, stage) =>
        stage === "specification" ? specification : artifact,
      getArtifactById: async () => undefined,
      getRecordById: async () => record,
      getLatestRecord: async () => undefined,
      listArtifacts: async () => ({ data: [] }),
      listRecords: async () => ({ data: [] }),
      commit: async (operations) => {
        commits++;
        for (const op of operations) {
          if (op.type === "create_artifact")
            artifact = {
              ...op.payload,
              id: op.id,
              revision: 1,
              createdAt: "t",
              updatedAt: "t",
            };
          if (op.type === "append_record")
            record = { ...op.payload, id: op.id, createdAt: "t" };
        }
        return {
          writtenArtifacts: artifact ? [artifact] : [],
          appendedRecords: record ? [record] : [],
          removedArtifactIds: [],
          removedRecordIds: [],
        };
      },
    },
  };
  await assert.rejects(finalize(null, access), /clear failed/);
  assert.equal(commits, 1);
  assert.equal(record?.id, "REC-RUN-test-solution");
  failClear = false;
  await finalize(null, access);
  assert.equal(commits, 1);
  assert.equal(value, undefined);
});
