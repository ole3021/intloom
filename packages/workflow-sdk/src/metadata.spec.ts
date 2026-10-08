import assert from "node:assert/strict";
import { test } from "node:test";
import { workflowMetadataSchema, workflowProtocolVersion } from "./metadata.ts";

test("validates strict metadata shape separately from protocol compatibility", () => {
  for (const version of [workflowProtocolVersion, "future-protocol"])
    assert.deepEqual(
      workflowMetadataSchema.parse({ type: "workflow", version }),
      {
        type: "workflow",
        version,
      },
    );
  for (const metadata of [
    {},
    { type: "agent", version: workflowProtocolVersion },
    { type: "workflow", version: "" },
    { type: "workflow", version: 1 },
    { type: "workflow", version: workflowProtocolVersion, extra: true },
  ])
    assert.equal(workflowMetadataSchema.safeParse(metadata).success, false);
});
