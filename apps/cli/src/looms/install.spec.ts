import assert from "node:assert/strict";
import { test } from "node:test";
import { workflowSource } from "./install.ts";

test("bare names explicitly select latest; versions and local archives retain their intended source", () => {
  assert.equal(
    workflowSource("@intloom/workflow-intent", "/project"),
    "@intloom/workflow-intent@latest",
  );
  assert.equal(
    workflowSource("intent-workflow", "/project"),
    "intent-workflow@latest",
  );
  assert.equal(
    workflowSource("@intloom/workflow-intent@1.2.3", "/project"),
    "@intloom/workflow-intent@1.2.3",
  );
  assert.equal(workflowSource("../workflow.tgz", "/project"), "/workflow.tgz");
  for (const invalid of [
    "",
    "--registry=elsewhere",
    "https://registry/package",
    "file:../package",
    "../package",
    "name with spaces",
  ]) {
    assert.throws(() => workflowSource(invalid, "/project"), {
      code: "INVALID_REQUEST",
    });
  }
});
