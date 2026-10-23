import assert from "node:assert/strict";
import { test } from "node:test";
import { modelCompletion } from "./model-completion.ts";

test("completion diagnostics separate missing, unknown and mismapped reasons", () => {
  const diagnostics = modelCompletion();
  assert.equal(diagnostics.summary("other").mapping, "unavailable");
  diagnostics.raw({ choices: [] });
  diagnostics.raw({ choices: [{ finish_reason: null }] });
  assert.equal(diagnostics.summary("other").mapping, "missing");
  diagnostics.raw({ choices: [{ finish_reason: "PRIVATE_UNKNOWN_REASON" }] });
  assert.equal(diagnostics.summary("other").mapping, "unrecognized");
  diagnostics.raw({ choices: [{ finish_reason: "tool_calls" }] });
  diagnostics.finish({ unified: "other", raw: "tool_calls" });
  assert.deepEqual(diagnostics.summary("other"), {
    rawChunks: 4,
    chatChunks: 4,
    finishMarkers: 2,
    upstreamReason: "tool_calls",
    finishParts: 1,
    adapterRawReason: "tool_calls",
    mapping: "mismatch",
  });
  assert.equal(diagnostics.summary("tool-calls").mapping, "matched");
  // A trailing usage-only chunk must not erase an observed finish reason.
  diagnostics.raw({ choices: [], usage: { total_tokens: 2 } });
  assert.equal(diagnostics.summary("tool-calls").mapping, "matched");
});

test("completion diagnostics never retain content or invoke accessors and serialization", () => {
  const secret = "PRIVATE_COMPLETION_SENTINEL";
  const forbidden = () => {
    throw new Error("Untrusted access is forbidden");
  };
  const diagnostics = modelCompletion();
  diagnostics.raw({
    get choices() {
      return forbidden();
    },
  });
  diagnostics.raw({
    choices: [
      {
        get finish_reason() {
          return forbidden();
        },
      },
    ],
    toJSON: forbidden,
  });
  diagnostics.raw({
    choices: [{ finish_reason: secret, delta: { content: secret } }],
    authorization: secret,
    toJSON: forbidden,
  });
  diagnostics.finish({ unified: "other", raw: secret, toJSON: forbidden });
  assert.equal(
    JSON.stringify(diagnostics.summary("other")).includes(secret),
    false,
  );
  assert.equal(diagnostics.summary("other").adapterRawReason, "unrecognized");
});
