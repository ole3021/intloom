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
