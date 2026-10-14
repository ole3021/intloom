import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentExecutionAccess, JsonValue } from "@intloom/workflow-sdk";
import { implementationStateSchema } from "../schemas/implementation-state.ts";
import { json } from "../src/flow/shared.ts";
import {
  readImplementationContext,
  submitImplementation,
} from "./implementation.ts";

test("implementation supplies exact cumulative context and corrects all list issues without a new Agent", async () => {
  let state = implementationStateSchema.parse({
    id: "RUN-test",
    intent: "implement",
    initialSnapshot: { "existing.mjs": "0".repeat(64) },
    specification: { id: "spec", revision: 1, data: { id: "SREQ-a" } },
    solution: { id: "sol", revision: 1, data: { id: "OMOD-a" } },
    feedbacks: [{ source: "check", content: "Repair the test fixture" }],
  });
  const access: AgentExecutionAccess<JsonValue> = {
    signal: new AbortController().signal,
    state: {
      get value() {
        return json(state);
      },
      create: async () => {},
      clear: async () => {},
      update: async (value) => {
        state = implementationStateSchema.parse(value);
      },
    },
    storage: {
      getArtifact: async () => undefined,
      getArtifactById: async () => undefined,
      getRecordById: async () => undefined,
      getLatestRecord: async () => undefined,
      listArtifacts: async () => ({ data: [] }),
      listRecords: async () => ({ data: [] }),
    },
    project: {
      snapshot: async () => ({
        "existing.mjs": "1".repeat(64),
        "test/new.test.mjs": "2".repeat(64),
      }),
      read: async () => "",
      write: async () => {},
      remove: async () => {},
      run: async () => {
        throw new Error("Submission must not execute commands");
      },
    },
  };
  const read = (await readImplementationContext.execute({}, access)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(
    (read.submissionContext as { changedPaths: string[] }).changedPaths,
    ["existing.mjs", "test/new.test.mjs"],
  );
  const invalid = await submitImplementation.execute(
    {
      changes: [
        {
          paths: [{ path: "data/removed.json" }],
          description: "removed smoke output",
          origin_refs: ["check-test"],
        },
      ],
      processedFeedbackCount: 100,
    },
    access,
  );
  assert.equal(invalid.saved, false);
  if (invalid.saved) assert.fail("Expected full correction feedback");
  assert.deepEqual(invalid.feedback.missingPaths, [
    "existing.mjs",
    "test/new.test.mjs",
  ]);
  assert.deepEqual(invalid.feedback.unchangedPaths, ["data/removed.json"]);
  assert.deepEqual(invalid.feedback.unknownOriginRefs, ["check-test"]);
  assert.equal(invalid.feedback.expectedFeedbackCount, 1);
  assert.deepEqual(state.changes, []);
  assert.equal(submitImplementation.endsAgent?.(invalid), false);
  const saved = await submitImplementation.execute(
    {
      changes: [
        {
          paths: [{ path: "existing.mjs" }, { path: "test/new.test.mjs" }],
          description: "implemented and tested",
          origin_refs: ["SREQ-a", "OMOD-a"],
        },
      ],
      processedFeedbackCount: 1,
    },
    access,
  );
  assert.deepEqual(saved, { saved: true });
  assert.equal(submitImplementation.endsAgent?.(saved), true);
  assert.equal(
    implementationStateSchema.parse(state).changes[0]?.paths.length,
    2,
  );
  assert.equal(state.processedFeedbackCount, 1);
  assert.equal(state.iterations, 2);
});
