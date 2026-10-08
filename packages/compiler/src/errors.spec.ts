import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { fail } from "./errors.ts";
import type { SourceLocation } from "./source/types.ts";

for (const [label, location, prefix] of [
  ["no location", undefined, ""],
  ["file only", { file: "workflow.yaml" }, "workflow.yaml: "],
  [
    "line and column",
    { file: "stage.yaml", line: 4, column: 7 },
    "stage.yaml:4:7: ",
  ],
  ["default column", { file: "stage.yaml", line: 4 }, "stage.yaml:4:1: "],
] satisfies [string, SourceLocation | undefined, string][]) {
  test(`fail preserves code, location and original cause: ${label}`, () => {
    const cause = new Error("original parser error");
    assert.throws(
      () => fail("INVALID_WORKFLOW", "Invalid route", location, cause),
      (error) => {
        assert.ok(LoomError.is(error));
        assert.equal(error.code, "INVALID_WORKFLOW");
        assert.equal(error.message, `${prefix}Invalid route`);
        assert.deepEqual(error.cause, { location, cause });
        assert.equal((error.cause as { cause: unknown }).cause, cause);
        return true;
      },
    );
  });
}
