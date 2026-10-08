import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";

const [, , filename, id, attempts] = process.argv;
assert.ok(filename && id && attempts);
const maxAttempts = Number(attempts);
assert.ok(Number.isInteger(maxAttempts) && maxAttempts > 0);

async function open(filename: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await openSqliteStorage({ filename, projectId: "project" });
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      // First-open WAL/migration contention may return a retryable BUSY.
      // Never retry a commit or an unrelated storage failure.
      assert.ok(
        error &&
          typeof error === "object" &&
          "code" in error &&
          "retryable" in error,
      );
      assert.equal(error.code, "BUSY");
      assert.equal(error.retryable, true);
      await setTimeout(50 * attempt);
    }
  }
}

const handle = await open(filename);
try {
  await handle.access.commit([
    {
      type: "append_record",
      id,
      payload: { flowName: "flow", stageName: "stage", data: id },
    },
  ]);
} finally {
  await handle.dispose();
}
