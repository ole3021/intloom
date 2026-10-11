import assert from "node:assert/strict";
import { test } from "node:test";
import { specificationPatchSchema } from "./specification-record.ts";

test("root additions require objects while field patches preserve JSON values", () => {
  const value = { id: "SCON-example", description: "Example", record_refs: [] };
  assert.deepEqual(
    specificationPatchSchema.parse({ op: "add", path: "", value }),
    { op: "add", path: "", value },
  );
  for (const invalid of [JSON.stringify(value), [], null, true, 1]) {
    assert.equal(
      specificationPatchSchema.safeParse({
        op: "add",
        path: "",
        value: invalid,
      }).success,
      false,
    );
  }
  for (const value of ["description", [], null, true, 1, { nested: [] }]) {
    assert.deepEqual(
      specificationPatchSchema.parse({ op: "add", path: "/field", value }),
      { op: "add", path: "/field", value },
    );
  }
});
