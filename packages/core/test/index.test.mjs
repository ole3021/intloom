import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "../dist/index.js";

test("compiled package exposes its public API", () => {
  assert.equal(greet("world"), "Hello, world!");
});
