import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readExecutionLimits } from "./execution-limits.ts";
test("host limits reject malformed config without exposing the body", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "host-limits-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal((await readExecutionLimits(root)).maxAgentSteps, 64);
  await mkdir(join(root, "intloom"));
  for (const value of [
    { maxAgentSteps: 0 },
    { run: { maxModelCalls: -1 } },
    { secret: "private sentinel" },
  ]) {
    await writeFile(join(root, "intloom/host.json"), JSON.stringify(value));
    await assert.rejects(readExecutionLimits(root), (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "CLI_EXECUTION_LIMITS_INVALID");
      assert.doesNotMatch(error.message, /sentinel/u);
      return true;
    });
  }
});
