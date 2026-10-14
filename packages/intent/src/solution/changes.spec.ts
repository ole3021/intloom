import assert from "node:assert/strict";
import { test } from "node:test";
import {
  solutionStateSchema,
  emptySolution,
} from "../../schemas/solution-state.ts";
import { json } from "../flow/shared.ts";
import { reviewSolution } from "./changes.ts";
function state() {
  return solutionStateSchema.parse({
    id: "RUN-test",
    intent: "todo",
    specification: {
      id: "spec",
      revision: 1,
      data: { requirements: [{ id: "SREQ-todo", status: "active" }] },
    },
    baseline: null,
    checks: [{ id: "test", purpose: "test", command: "node", args: [] }],
    changes: [
      {
        target_ref: "OAPP-todo",
        reason: "app",
        patch: [
          {
            op: "add",
            path: "",
            value: {
              id: "OAPP-todo",
              name: "Todo",
              type: "web",
              description: "todo",
              modules: [
                {
                  id: "OMOD-store",
                  name: "Store",
                  status: "active",
                  parent_ref: "OAPP-todo",
                  description: "store",
                  requirement_refs: ["SREQ-todo"],
                },
              ],
            },
          },
        ],
      },
    ],
  });
}
test("solution resolves references and requires matching module containment", () => {
  const s = state();
  const result = reviewSolution(s);
  assert.deepEqual(result.originRefs, ["SREQ-todo"]);
  assert.ok(s.specification);
  s.specification.data = {};
  assert.throws(() => reviewSolution(s), /Unknown Solution reference/);
  const bad = state();
  const patch = bad.changes[0]?.patch[0];
  assert.ok(patch);
  assert.ok("value" in patch);
  const app = patch.value as { modules: { parent_ref: string }[] };
  const module = app.modules[0];
  assert.ok(module);
  module.parent_ref = "OAPP-missing";
  assert.throws(() => reviewSolution(bad), /reference|parent/);
});
test("solution cannot remove a structural identity through a parent patch", () => {
  const s = state();
  s.baseline = {
    id: "solution",
    revision: 1,
    data: json(reviewSolution(s).artifact),
  };
  s.changes = [
    {
      target_ref: "OAPP-todo",
      reason: "remove",
      patch: [{ op: "replace", path: "/modules", value: [] }],
    },
  ];
  assert.throws(() => reviewSolution(s), /cannot be deleted/);
  s.changes = [];
  s.baseline = { id: "solution", revision: 1, data: json(emptySolution()) };
  s.questions = [
    { id: "QST-1", question: "unknown", isBlock: false, skipped: true },
  ];
  assert.throws(() => reviewSolution(s), /active Risk/);
});

test("new Solution provenance is derived by Code and existing history remains protected", () => {
  const s = state();
  s.changes.push({
    target_ref: "OCON-task",
    reason: "Define task",
    patch: [
      {
        op: "add",
        path: "",
        value: {
          id: "OCON-task",
          name: "Task",
          status: "active",
          definition: "A local task",
          rules: [
            {
              id: "OCON-task-RULE-1",
              description: "Keep task identity",
              record_refs: ["RUN-upstream"],
            },
          ],
          record_refs: ["RUN-upstream"],
        },
      },
    ],
  });
  const original = structuredClone(s.changes);
  const result = reviewSolution(s);
  assert.deepEqual(result.artifact.concepts[0]?.record_refs, ["RUN-test"]);
  assert.equal(
    "record_refs" in (result.artifact.concepts[0]?.rules[0] ?? {}),
    false,
  );
  assert.deepEqual(s.changes, original);
  const invalid = structuredClone(s);
  const added = invalid.changes.at(-1)?.patch[0];
  assert.ok(
    added &&
      "value" in added &&
      added.value &&
      typeof added.value === "object" &&
      !Array.isArray(added.value),
  );
  added.value.unexpected = true;
  assert.throws(() => reviewSolution(invalid), /unexpected/);
  s.baseline = { id: "sol", revision: 1, data: json(result.artifact) };
  s.changes = [
    {
      target_ref: "OCON-task",
      reason: "Replace history",
      patch: [{ op: "replace", path: "/record_refs", value: ["RUN-forged"] }],
    },
  ];
  assert.throws(() => reviewSolution(s), /managed by Code/);
});

test("cumulative Solution feedback identifies missing draft creation and exact reference location", () => {
  const s = state();
  s.changes = [
    {
      target_ref: "OAPP-todo",
      reason: "Revise an uncommitted draft",
      patch: [{ op: "replace", path: "/description", value: "updated" }],
    },
  ];
  assert.throws(
    () => reviewSolution(s),
    /Change\[0\] target_ref OAPP-todo, patch\[0\] path "\/description": rule TARGET_NOT_FOUND:.*retain the root add/,
  );
  const revised = state();
  const patch = revised.changes[0]?.patch[0];
  assert.ok(patch && "value" in patch);
  (patch.value as { description: string }).description = "updated";
  assert.equal(
    reviewSolution(revised).artifact.structure.apps[0]?.description,
    "updated",
  );
  const missing = state();
  assert.ok(missing.specification);
  missing.specification.data = {};
  assert.throws(
    () => reviewSolution(missing),
    /target_ref OAPP-todo, path "\/modules\/0\/requirement_refs\/0": rule REFERENCE_NOT_FOUND: Unknown Solution reference: SREQ-todo/,
  );
});
