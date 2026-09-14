import assert from "node:assert/strict";
import test from "node:test";
import { selectDeploymentTarget } from "../scripts/deployment-target.mjs";

test("only master selects a production deployment", () => {
  assert.deepEqual(selectDeploymentTarget("master"), {
    script: "ci:deploy",
    alias: "",
  });
  for (const branch of [
    undefined,
    "",
    "main",
    "fix-bug",
    "feat/search",
    "feat-search/nested",
  ]) {
    assert.throws(
      () => selectDeploymentTarget(branch),
      /Only master and feat-/,
    );
  }
  for (const refType of ["tag", ""]) {
    assert.throws(
      () => selectDeploymentTarget("master", refType),
      /Only master and feat-/,
    );
  }
});

test("feature aliases are bounded, safe, stable and distinct", () => {
  const branches = [
    "feat-Search",
    "feat-search",
    "feat-中文",
    `feat-${"x".repeat(100)}`,
    `feat-${"x".repeat(100)}-other`,
  ];
  const aliases = branches.map((branch) => {
    const target = selectDeploymentTarget(branch);
    assert.equal(target.script, "ci:preview");
    assert.match(target.alias, /^[a-z][a-z0-9-]{0,30}$/);
    assert.deepEqual(selectDeploymentTarget(branch), target);
    return target.alias;
  });
  assert.equal(new Set(aliases).size, aliases.length);
});
