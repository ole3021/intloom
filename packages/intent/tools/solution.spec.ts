import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentExecutionAccess, JsonValue } from "@intloom/workflow-sdk";
import { solutionStateSchema } from "../schemas/solution-state.ts";
import { draftRevision } from "../src/flow/draft.ts";
import { json } from "../src/flow/shared.ts";
import { submitSolution } from "./solution.ts";

function fixture() {
  const question = {
    id: "QST-1" as const,
    question: "Which storage?",
    description: "Local storage choice",
    isBlock: true,
    answer: "A local JSON file.",
  };
  let state = solutionStateSchema.parse({
    id: "RUN-test",
    intent: "Local scope",
    specification: { id: "spec", revision: 1, data: {} },
    baseline: null,
    questions: [question],
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
        state = solutionStateSchema.parse(value);
      },
      clear: async () => {
        throw Error("unused");
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
  };
  const input = submitSolution.inputSchema.parse({
    questions: [],
    draftRevision: draftRevision(state),
    checks: [
      {
        id: "test",
        purpose: "Run local tests",
        command: "node",
        args: ["--test"],
      },
    ],
  });
  return {
    access,
    input,
    question,
    get state() {
      return state;
    },
  };
}

test("Solution preserves omitted question history and accepts new questions without copying draft changes", async () => {
  const f = fixture();
  assert.deepEqual(await submitSolution.execute(f.input, f.access), {
    saved: true,
  });
  assert.deepEqual(f.state.questions, [f.question]);
  f.input.draftRevision = draftRevision(f.state);
  const { answer: _answer, ...historical } = f.question;
  f.input.questions = [
    historical,
    {
      id: "QST-2",
      question: "Any export format?",
      description: "Future scope",
      isBlock: false,
    },
  ];
  assert.deepEqual(await submitSolution.execute(f.input, f.access), {
    saved: true,
  });
  assert.equal(f.state.questions.length, 2);
  assert.deepEqual(f.state.questions[0], f.question);
});

test("invalid Solution proposals return correction feedback without replacing accepted data or human answers", async () => {
  for (const problem of ["content", "duplicate", "options"] as const) {
    const f = fixture();
    const { answer: _answer, ...historical } = f.question;
    if (problem === "content")
      f.input.questions = [{ ...historical, question: "Changed question" }];
    if (problem === "duplicate") f.input.questions = [historical, historical];
    if (problem === "options")
      f.input.questions = [
        {
          id: "QST-2",
          question: "Choose",
          description: "Choice",
          isBlock: false,
          options: [{ id: "QST-9:one", label: "Choice" }],
        },
      ];
    const result = await submitSolution.execute(f.input, f.access);
    assert.equal(result.saved, false);
    assert.deepEqual(submitSolution.outputSchema.parse(result), result);
    if (result.saved) assert.fail("Expected correction feedback");
    assert.equal(result.feedback.rule, "SOLUTION_PROPOSAL_INVALID");
    assert.deepEqual(result.feedback.existingQuestionIds, ["QST-1"]);
    assert.deepEqual(f.state.questions, [f.question]);
    assert.deepEqual(f.state.changes, []);
    assert.equal(f.state.iterations, 1);
    f.input.questions = [];
    f.input.draftRevision = draftRevision(f.state);
    assert.deepEqual(await submitSolution.execute(f.input, f.access), {
      saved: true,
    });
  }
});

test("malformed revisions fail schema validation and stale revisions preserve the submission budget", async () => {
  const f = fixture();
  for (const revision of [
    "stale",
    `${f.input.draftRevision}"}`,
    "A".repeat(64),
  ])
    assert.equal(
      submitSolution.inputSchema.safeParse({
        ...f.input,
        draftRevision: revision,
      }).success,
      false,
    );
  const before = structuredClone(f.state);
  for (let attempt = 0; attempt < 14; attempt++) {
    const result = await submitSolution.execute(
      { ...f.input, draftRevision: "0".repeat(64) },
      f.access,
    );
    assert.equal(result.saved, false);
    if (result.saved) assert.fail("Expected stale revision");
    assert.equal(result.draftRevision, f.input.draftRevision);
    assert.deepEqual(submitSolution.outputSchema.parse(result), result);
    assert.deepEqual(f.state, before);
  }
  assert.deepEqual(await submitSolution.execute(f.input, f.access), {
    saved: true,
  });
  assert.equal(f.state.iterations, 1);
});

test("Solution state failures remain fatal rather than proposal feedback", async () => {
  const f = fixture();
  const error = Error("Actual state failure");
  f.access.state.update = async () => {
    throw error;
  };
  await assert.rejects(
    Promise.resolve().then(() => submitSolution.execute(f.input, f.access)),
    (cause: unknown) => cause === error,
  );
});
