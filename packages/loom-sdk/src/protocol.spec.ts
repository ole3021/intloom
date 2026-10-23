import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  loomMetadataSchema,
  loomProtocolVersion,
  loomNameSchema,
  codeIdSchema,
  agentIdSchema,
} from "./protocol.ts";

test("validates strict metadata shape separately from protocol compatibility", () => {
  for (const version of [loomProtocolVersion, "future-protocol"])
    assert.deepEqual(loomMetadataSchema.parse({ type: "loom", version }), {
      type: "loom",
      version,
    });
});

describe("metadata shape", () => {
  for (const [name, metadata] of [
    ["missing fields", {}],
    ["wrong package type", { type: "agent", version: loomProtocolVersion }],
    ["empty version", { type: "loom", version: "" }],
    ["non-string version", { type: "loom", version: 1 }],
    [
      "unknown field",
      { type: "loom", version: loomProtocolVersion, extra: true },
    ],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.equal(loomMetadataSchema.safeParse(metadata).success, false);
    });
  }
});

test("names preserve author text but exclude empty, padded and prototype keys", () => {
  for (const name of ["review", "review-draft", "审核"])
    assert.equal(loomNameSchema.parse(name), name);
  for (const name of [
    "",
    " ",
    " review",
    "review ",
    "__proto__",
    "prototype",
    "constructor",
  ])
    assert.equal(loomNameSchema.safeParse(name).success, false, name);
});

for (const [prefix, schema] of [
  ["CODE", codeIdSchema],
  ["AGENT", agentIdSchema],
] as const) {
  test(`${prefix} IDs require the resource prefix and a 21-character suffix`, () => {
    const suffix = `${"a".repeat(19)}_-`;
    assert.equal(schema.parse(`${prefix}-${suffix}`), `${prefix}-${suffix}`);
    for (const id of [
      `${prefix}-short`,
      `${prefix}-${"a".repeat(22)}`,
      `OTHER-${suffix}`,
      `${prefix.toLowerCase()}-${suffix}`,
    ])
      assert.equal(schema.safeParse(id).success, false, id);
  });
}
