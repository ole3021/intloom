import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFilePaths } from "./files.ts";

test("safe file manifests reject case normalization, traversal and target Code conflicts", () => {
  assert.throws(
    () =>
      validateFilePaths({
        schemaVersion: 1,
        entries: [
          { type: "directory", path: "A" },
          { type: "directory", path: "a" },
        ],
        includes: [],
        excluded: [],
      }),
    /normalized/u,
  );
  for (const path of [
    "../escape",
    "/absolute",
    "x/../escape",
    ".intloom/looms/file",
    "src/file",
  ]) {
    assert.throws(() =>
      validateFilePaths(
        {
          schemaVersion: 1,
          entries: [{ type: "directory", path }],
          includes: [],
          excluded: [],
        },
        { protectedPaths: ["src/file"] },
      ),
    );
  }
});
