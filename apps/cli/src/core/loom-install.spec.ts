import assert from "node:assert/strict";
import { test } from "node:test";
import { loomSource } from "@intloom/kernel/host";

test("bare names explicitly select latest; versions and local archives retain their intended source", () => {
  assert.equal(
    loomSource("@intloom/loom-intent", "/project"),
    "@intloom/loom-intent@latest",
  );
  assert.equal(loomSource("intent-loom", "/project"), "intent-loom@latest");
  assert.equal(
    loomSource("@intloom/loom-intent@1.2.3", "/project"),
    "@intloom/loom-intent@1.2.3",
  );
  assert.equal(loomSource("../loom.tgz", "/project"), "/loom.tgz");
  for (const invalid of [
    "",
    "--registry=elsewhere",
    "https://registry/package",
    "file:../package",
    "../package",
    "name with spaces",
  ]) {
    assert.throws(() => loomSource(invalid, "/project"), {
      code: "INVALID_REQUEST",
    });
  }
});
