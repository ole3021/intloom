import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runtime,
  specification,
  design,
  plan,
  analysis,
} from "../../../test/runtime.ts";
import { readState } from "./actions.ts";
import { checkSolution } from "./rules.ts";
import { solutionTargets } from "../../../src/targets.ts";
function state() {
  return readState(
    runtime("solution", {
      specification: specification(),
      draft: design,
      plan,
      analysis,
    }).access,
  );
}
test("complete work/design/implementation/verification coverage is accepted", () =>
  checkSolution(state()));
test("cycles and missing verification responsibilities are rejected", () => {
  const s = state();
  const item = s.plan?.implementationItems[0];
  assert.ok(item);
  item.dependsOn = ["IMPL-a"];
  assert.throws(() => checkSolution(s), /acyclic/);
  const missing = state();
  assert.ok(missing.plan);
  missing.plan.coverage = [];
  assert.throws(() => checkSolution(missing), /Coverage/);
});
test("preparation items need no invented design object but remain in the dependency graph", () => {
  const s = state();
  assert.ok(s.plan);
  const item = s.plan.implementationItems[0];
  assert.ok(item);
  s.plan.implementationItems.unshift({
    id: "IMPL-prep",
    description: "Prepare fixture",
    designRefs: [],
    dependsOn: [],
    explanation: "Execution prerequisite",
  });
  item.dependsOn = ["IMPL-prep"];
  checkSolution(s);
});
test("target definition identity includes requirement meaning, not only acceptance wording", () => {
  const spec = specification(),
    first = solutionTargets(spec, design, plan);
  const requirement = spec.snapshot.requirements[0];
  assert.ok(requirement);
  requirement.description = "Greet uppercase Unicode names";
  const changed = solutionTargets(spec, design, plan)[0];
  assert.ok(changed);
  assert.ok(first[0]);
  assert.notEqual(changed.definitionDigest, first[0].definitionDigest);
});
