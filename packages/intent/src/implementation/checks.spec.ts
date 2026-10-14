import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectAccess } from "@intloom/workflow-sdk";
import { implementationStateSchema } from "../../schemas/implementation-state.ts";
import { validateChanges, runChecks, passed } from "./checks.ts";
test("implementation requires exact changed files and known origins", () => {
  const state = implementationStateSchema.parse({
    id: "RUN-test",
    intent: "todo",
    initialSnapshot: { a: "0".repeat(64) },
    specification: { id: "spec", revision: 1, data: { id: "SREQ-a" } },
    changes: [
      { paths: [{ path: "a" }], description: "edit", origin_refs: ["SREQ-a"] },
    ],
  });
  validateChanges(state, { a: "new" });
  assert.throws(
    () => validateChanges(state, { a: "new", b: "extra" }),
    /Unrecorded/,
  );
  assert.throws(
    () => validateChanges(state, { a: "0".repeat(64) }),
    /no actual/,
  );
  const change = state.changes[0];
  assert.ok(change);
  change.origin_refs = ["SREQ-missing"];
  assert.throws(() => validateChanges(state, { a: "new" }), /Unknown/);
});
test("host checks reject source mutation and preserve real failure results", async () => {
  let counter = 0;
  const project: ProjectAccess = {
    snapshot: async () => ({ a: String(counter++) }),
    read: async () => "",
    write: async () => {},
    remove: async () => {},
    run: async (command) => ({
      command,
      exitCode: 1,
      stdout: "",
      stderr: "fail",
      timedOut: false,
      truncated: false,
    }),
  };
  const checks = [{ id: "tests", purpose: "test", command: "node", args: [] }];
  await assert.rejects(runChecks(project, checks), /changed source/);
  project.snapshot = async () => ({ a: "fixed" });
  const result = await runChecks(project, checks);
  const executed = result.results[0];
  assert.ok(executed);
  assert.equal(passed(executed), false);
  assert.equal(executed.stderr, "fail");
});

test("host checks accept isolated runtime data cleaned up before exit", async () => {
  let files = { "source.mjs": "fixed" };
  const project: ProjectAccess = {
    snapshot: async () => ({ ...files }),
    read: async () => "",
    write: async () => {},
    remove: async () => {},
    run: async (command) => {
      files = { ...files, ...{ "data/fixture.json": "temporary" } };
      files = { "source.mjs": "fixed" };
      return {
        command,
        exitCode: 0,
        stdout: "passed",
        stderr: "",
        timedOut: false,
        truncated: false,
      };
    },
  };
  const checked = await runChecks(project, [
    {
      id: "tests",
      purpose: "behavior",
      command: "node",
      args: ["--test"],
    },
  ]);
  assert.ok(checked.results[0]);
  assert.equal(passed(checked.results[0]), true);
});
