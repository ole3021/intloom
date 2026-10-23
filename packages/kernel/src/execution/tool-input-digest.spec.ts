import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { toolInputDigest } from "./tool-input-digest.ts";

test("Tool input digests identify exact reference candidates without exposing them", () => {
  const input = { evidenceRef: "EVD-private-reference" };
  assert.equal(
    toolInputDigest(input),
    createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  );
  assert.notEqual(
    toolInputDigest(input),
    toolInputDigest({ evidenceRef: "EVD-other" }),
  );
  assert.equal(
    toolInputDigest({ b: [true, null, 1], a: "source" }),
    toolInputDigest({ a: "source", b: [true, null, 1] }),
  );
});

test("diagnostics skip accessors, toJSON, proxies, cycles and oversized inputs", () => {
  let invoked = false;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      invoked = true;
      return "private";
    },
  });
  const toJSON = {
    toJSON() {
      invoked = true;
      return "private";
    },
  };
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        invoked = true;
        return null;
      },
    },
  );
  const cycle: Record<string, unknown> = {};
  cycle.value = cycle;
  for (const input of [
    accessor,
    toJSON,
    proxy,
    cycle,
    "x".repeat(1024 * 1024 + 1),
    Array(20000).fill(null),
    new Date(),
    undefined,
  ])
    assert.equal(toolInputDigest(input), undefined);
  assert.equal(invoked, false);
});
