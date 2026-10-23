import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Evidence, redact } from "./evidence.ts";
import { captureConsole } from "./console.ts";

test("provider credentials and owner tokens are redacted in structured and text MCP content", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const evidence = new Evidence(root);
  evidence.secrets.push("provider-secret");
  const data = { ownerToken: "owner-secret", text: "provider-secret" };
  evidence.protect(data);
  evidence.protect({
    content: [{ text: JSON.stringify({ ownerToken: "text-only-owner" }) }],
  });
  await evidence.event("mcp", {
    data,
    content: [{ text: JSON.stringify(data) }],
    authorization: "Bearer another-token",
    textOnly: '{"ownerToken":"text-only-owner"}',
  });
  const text = await readFile(join(root, "actions.jsonl"), "utf8");
  for (const secret of [
    "provider-secret",
    "owner-secret",
    "another-token",
    "text-only-owner",
  ])
    assert.equal(text.includes(secret), false);
  assert.deepEqual(redact({ count: 0, token: "private" }, []), {
    count: 0,
    token: "[REDACTED]",
  });
});

test("the command entry records SDK console diagnostics with redaction and restores the console", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-console-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const evidence = new Evidence(root);
  evidence.secrets.push("provider-secret");
  const original = globalThis.console;
  const restore = captureConsole(evidence);
  try {
    console.error("SDK diagnostic", { detail: "provider-secret" });
  } finally {
    await restore();
  }
  assert.equal(globalThis.console, original);
  const event = JSON.parse(await readFile(join(root, "actions.jsonl"), "utf8"));
  assert.equal(event.kind, "sdk_diagnostic");
  assert.match(event.data.message, /SDK diagnostic/u);
  assert.match(event.data.message, /\[REDACTED\]/u);
  assert.equal(event.data.message.includes("provider-secret"), false);
});
