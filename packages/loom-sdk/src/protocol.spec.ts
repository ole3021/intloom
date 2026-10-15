import assert from "node:assert/strict";
import { test } from "node:test";
import { loomMetadataSchema, loomProtocolVersion } from "./protocol.ts";

test("validates strict metadata shape separately from protocol compatibility", () => {
  for (const version of [loomProtocolVersion, "future-protocol"])
    assert.deepEqual(loomMetadataSchema.parse({ type: "loom", version }), {
      type: "loom",
      version,
    });
  for (const metadata of [
    {},
    { type: "agent", version: loomProtocolVersion },
    { type: "loom", version: "" },
    { type: "loom", version: 1 },
    { type: "loom", version: loomProtocolVersion, extra: true },
  ])
    assert.equal(loomMetadataSchema.safeParse(metadata).success, false);
});
