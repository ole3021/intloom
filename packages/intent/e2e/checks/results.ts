import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { imageSchema, verifyFacts, type Stored } from "./facts.ts";

// Optional Intent-owned assertions. Direct commit references avoid list pagination and mutable final-state evidence.
const contextPath = process.argv[2];
assert.ok(contextPath, "Provide an E2E round context JSON file.");
const context = JSON.parse(await readFile(contextPath, "utf8"));
const invoke = promisify(execFile);
async function cli(args: string[]) {
  const result = await invoke(
    process.execPath,
    [
      context.cli,
      "--project",
      context.project,
      ...args,
      "--json",
      "--no-color",
      "--no-interactive",
    ],
    { timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
  );
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  return envelope.data;
}
const artifacts: Stored[] = [],
  records: Stored[] = [];
for (const ref of context.run.results ?? []) {
  if (ref.kind !== "artifact" && ref.kind !== "record") continue;
  const value = await cli([ref.kind, ref.id]);
  assert.equal(value.id, ref.id);
  assert.equal(value.stageName, ref.stageName);
  if (ref.kind === "artifact") {
    assert.equal(value.revision, ref.revision);
    artifacts.push(value);
  } else records.push(value);
}
const images = imageSchema
  .array()
  .parse(await cli(["mirror", "list"]))
  .filter((image) => image.runId === context.run.runId);
const originalIntents: string[] = [];
let mirrorsValid = true;
for (let offset = 0; offset < images.length; offset += 4) {
  for (const result of await Promise.all(
    images
      .slice(offset, offset + 4)
      .map((image) => cli(["mirror", "inspect", image.mirrorId])),
  )) {
    mirrorsValid &&= result.integrity.valid;
    originalIntents.push(result["checkpoint.json"].run.intent);
  }
}
const checks = verifyFacts({
  run: context.run,
  intent: context.intent,
  source: context.entry === "cmd" ? "cli" : "agent_ide",
  executor: context.entry === "cmd" ? "service" : "mcp_client",
  storage: context.storage,
  artifacts,
  records,
  images,
  mirrorsValid,
  originalIntents,
  confirmations: context.confirmations,
});
for (const previous of context.previousRuns) {
  for (const ref of previous.results ?? []) {
    if (ref.kind === "record")
      assert.equal((await cli(["record", ref.id])).data.id, previous.runId);
    if (ref.kind === "artifact")
      assert.ok((await cli(["artifact", ref.id])).revision >= ref.revision);
  }
}
await writeFile(
  context.output,
  `${JSON.stringify({ round: context.round, runId: context.run.runId, commits: context.run.results, checks }, null, 2)}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(JSON.stringify({ runId: context.run.runId, checks }));
assert.ok(
  checks.every((check) => check.status === "passed"),
  "Intent business-evidence checks failed",
);
