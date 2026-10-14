import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime, agentAccess } from "../test/runtime.ts";
import init from "../codes/specification/init.ts";
import {
  editSpecification,
  readSpecification,
  submitSpecification,
} from "./specification.ts";
import { specificationStateSchema } from "../schemas/specification-state.ts";
import { applyChanges, emptyArtifact } from "../src/specification/changes.ts";
import { draftRevision, objectChanges } from "../src/flow/draft.ts";
import { solutionEditSchema } from "../schemas/draft.ts";
import { reviewSolution } from "../src/solution/changes.ts";
import { solutionStateSchema } from "../schemas/solution-state.ts";

test("parent and explicit child edits compile once in either order, including newly embedded modules", () => {
  const module = {
    id: "OMOD-ui",
    parent_ref: "OAPP-web",
    status: "active",
    name: "UI",
    description: "Old",
  };
  const app = {
    id: "OAPP-web",
    name: "Web",
    type: "web",
    description: "Browser",
    modules: [module],
  };
  const historical = {
    ...module,
    id: "OMOD-historical",
    status: "retired",
    description: "Historical",
  };
  const edits = [
    {
      value: {
        ...app,
        modules: [{ ...module, description: "Embedded" }, historical],
      },
      reason: "Update application",
    },
    {
      value: { ...module, description: "Explicit child" },
      reason: "Update interface",
    },
    { value: historical, reason: "Preserve historical module" },
  ];
  for (const fresh of [false, true])
    for (const reversed of [false, true]) {
      const state = solutionStateSchema.parse({
        id: "RUN-edit",
        intent: "Update",
        specification: { id: "spec", revision: 1, data: {} },
        baseline: fresh
          ? null
          : {
              id: "solution",
              revision: 1,
              data: {
                structure: {
                  apps: [app],
                  packages: [],
                  resources: [],
                  relations: [],
                },
                concepts: [],
                scenarios: [],
                decisions: [],
                risks: [],
                diagrams: [],
              },
            },
      });
      const current = reviewSolution(state, true, true).artifact;
      state.changes = objectChanges(
        current,
        reversed ? [...edits].reverse() : edits,
      );
      assert.equal(state.changes.length, 1);
      const result = reviewSolution(state, true).artifact;
      assert.deepEqual(
        result.structure.apps[0]?.modules.map((m) => [m.id, m.description]),
        [
          ["OMOD-ui", "Explicit child"],
          ["OMOD-historical", "Historical"],
        ],
      );
      assert.match(state.changes[0]?.reason ?? "", /Update interface/);
      state.changes.push(
        ...objectChanges(result, [
          {
            value: { ...module, description: "Next accepted edit" },
            reason: "Follow-up",
          },
        ]),
      );
      assert.equal(
        reviewSolution(state, true).artifact.structure.apps[0]?.modules[0]
          ?.description,
        "Next accepted edit",
      );
    }
});

const constraint = {
  id: "SCON-local" as const,
  status: "active" as const,
  description: "Use local files",
};
test("incremental edits preserve earlier objects, reject stale edits and compile protected history", async () => {
  const r = runtime();
  await init(null, r.access);
  const access = agentAccess(r.access);
  const revision = () => draftRevision(specificationStateSchema.parse(r.state));
  const firstRevision = revision();
  const first = await editSpecification.execute(
    {
      draftRevision: firstRevision,
      edits: [{ value: constraint, reason: "Local scope" }],
      removeAcceptances: [],
    },
    access,
  );
  assert.equal(first.saved, true);
  const second = await editSpecification.execute(
    {
      draftRevision: revision(),
      edits: [
        {
          value: {
            id: "SCON-no-cloud",
            status: "active",
            description: "No cloud",
          },
          reason: "User boundary",
        },
      ],
      removeAcceptances: [],
    },
    access,
  );
  assert.equal(second.saved, true);
  const before = structuredClone(r.state);
  assert.equal(
    (
      await editSpecification.execute(
        {
          draftRevision: firstRevision,
          edits: [
            { value: { ...constraint, description: "Wrong" }, reason: "Stale" },
          ],
          removeAcceptances: [],
        },
        access,
      )
    ).saved,
    false,
  );
  assert.deepEqual(r.state, before);
  assert.equal(
    (
      await editSpecification.execute(
        {
          draftRevision: revision(),
          edits: [
            {
              value: { ...constraint, description: "Persist local JSON" },
              reason: "Answer",
            },
          ],
          removeAcceptances: [],
        },
        access,
      )
    ).saved,
    true,
  );
  const state = specificationStateSchema.parse(r.state);
  const actual = applyChanges(
    emptyArtifact(),
    state.changes,
    state.id,
  ).artifact;
  assert.equal(actual.constraints.length, 2);
  assert.deepEqual(actual.constraints[0]?.record_refs, [state.id]);
  assert.equal(actual.constraints[0]?.description, "Persist local JSON");
  assert.deepEqual(
    await submitSpecification.execute(
      { questions: [], draftRevision: revision() },
      access,
    ),
    { saved: true },
  );
  const view = JSON.stringify(await readSpecification.execute({}, access));
  assert.doesNotMatch(view, /record_refs|"patch"|artifactSchema|baseline/);
});

test("editable schemas reject provenance; invalid related objects do not mutate accepted drafts", async () => {
  assert.equal(
    solutionEditSchema.safeParse({
      draftRevision: "0".repeat(64),
      edits: [
        {
          reason: "bad",
          value: {
            id: "ORISK-x",
            status: "active",
            name: "x",
            description: "x",
            impact: "x",
            record_refs: [],
          },
        },
      ],
    }).success,
    false,
  );
  const r = runtime();
  await init(null, r.access);
  const before = structuredClone(r.state);
  const result = await editSpecification.execute(
    {
      draftRevision: draftRevision(specificationStateSchema.parse(r.state)),
      edits: [
        {
          value: {
            id: "SFEA-invalid",
            domain_ref: "SDOM-missing",
            responsibility: "Feature",
            status: "active",
          },
          reason: "Broken reference",
        },
      ],
      removeAcceptances: [],
    },
    agentAccess(r.access),
  );
  assert.equal(result.saved, false);
  assert.deepEqual(r.state, before);
});

test("questions can be submitted without drafting requirements", async () => {
  const r = runtime();
  await init(null, r.access);
  assert.deepEqual(
    await submitSpecification.execute(
      {
        draftRevision: draftRevision(specificationStateSchema.parse(r.state)),
        questions: [{ id: "QST-1", question: "Which storage?", isBlock: true }],
      },
      agentAccess(r.access),
    ),
    { saved: true },
  );
  assert.deepEqual(specificationStateSchema.parse(r.state).changes, []);
});

test("Solution edits modify uncommitted new objects without replaying root adds", () => {
  const state = solutionStateSchema.parse({
    id: "RUN-test",
    intent: "Local",
    specification: { id: "spec", revision: 1, data: {} },
    baseline: null,
  });
  const value = {
    id: "OCON-local",
    name: "Local",
    status: "active",
    definition: "Local files",
    rules: [],
  };
  state.changes = objectChanges(reviewSolution(state, true).artifact, [
    { value, reason: "Initial" },
  ]);
  const first = reviewSolution(state, true).artifact;
  state.changes.push(
    ...objectChanges(first, [
      { value: { ...value, definition: "Local JSON files" }, reason: "Answer" },
    ]),
  );
  const result = reviewSolution(state, true).artifact;
  assert.equal(result.concepts[0]?.definition, "Local JSON files");
  assert.deepEqual(result.concepts[0]?.record_refs, [state.id]);
  assert.equal(
    state.changes
      .flatMap((c) => c.patch)
      .filter((p) => p.path === "" && p.op === "add").length,
    1,
  );
});

test("an old design remains readable and editable when this Run retires an upstream requirement", () => {
  const value = {
    id: "OCON-old",
    name: "Old",
    status: "active",
    definition: "Old design",
    constraint_refs: ["SCON-old"],
    rules: [],
    record_refs: ["RUN-old"],
  };
  const state = solutionStateSchema.parse({
    id: "RUN-next",
    intent: "Retire",
    specification: {
      id: "spec",
      revision: 2,
      data: { constraints: [{ id: "SCON-old", status: "retired" }] },
    },
    baseline: {
      id: "solution",
      revision: 1,
      data: {
        structure: { apps: [], packages: [], resources: [], relations: [] },
        concepts: [value],
        scenarios: [],
        decisions: [],
        risks: [],
        diagrams: [],
      },
    },
  });
  assert.throws(() => reviewSolution(state, true), /ACTIVE_REFERENCE_RETIRED/);
  const current = reviewSolution(state, true, true).artifact;
  const { record_refs: _history, ...editable } = value;
  state.changes = objectChanges(current, [
    {
      value: { ...editable, status: "retired" },
      reason: "Requirement retired",
    },
  ]);
  assert.equal(
    reviewSolution(state, true).artifact.concepts[0]?.status,
    "retired",
  );
});

test("participant authoring schema requires typed references instead of late business-rule repairs", () => {
  const scenario = {
    id: "OSCN-one",
    status: "active",
    description: "Call module",
    requirement_refs: [],
    participants: [{ id: "OPAR-module", type: "module", name: "Module" }],
    steps: [],
    outcomes: [],
  };
  const input = {
    draftRevision: "0".repeat(64),
    edits: [{ value: scenario, reason: "Design" }],
  };
  assert.equal(solutionEditSchema.safeParse(input).success, false);
  assert.equal(
    solutionEditSchema.safeParse({
      ...input,
      edits: [
        {
          ...input.edits[0],
          value: {
            ...scenario,
            participants: [{ ...scenario.participants[0], ref: "OMOD-cli" }],
          },
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    solutionEditSchema.safeParse({
      ...input,
      edits: [
        {
          ...input.edits[0],
          value: {
            ...scenario,
            participants: [
              { ...scenario.participants[0], type: "actor", ref: "OMOD-cli" },
            ],
          },
        },
      ],
    }).success,
    false,
  );
});
