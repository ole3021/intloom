import assert from "node:assert/strict";
import { test } from "node:test";
import { pendingUserActionSchema } from "./pending-user-action.ts";

test("validates the authoritative action cursor and rejects previously accepted invalid cursors", () => {
  const action = {
    id: "ASK-1",
    flowName: "intent",
    cursor: { stageName: "specification", stepName: "confirm" },
    kind: "user_ask_confirmation",
    request: { context: "Confirm requirements" },
    createdAt: "2026-10-05T00:00:00Z",
  };
  assert.deepEqual(pendingUserActionSchema.parse(action), action);
  for (const cursor of [123, null, {}, { stageName: "specification" }]) {
    assert.equal(
      pendingUserActionSchema.safeParse({ ...action, cursor }).success,
      false,
    );
  }
});
