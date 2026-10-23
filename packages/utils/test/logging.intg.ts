import { deferred } from "./deferred.ts";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { test } from "node:test";
import pretty from "pino-pretty";
import { getLogger, openLog, readLog, withLogger } from "@intloom/utils";

test("public logger context writes each concurrent Run identity to its own records", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-log-context-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const handle = await openLog({ directory: root });
  t.after(() => handle.close());
  const entered = deferred();
  const release = deferred();
  const first = withLogger(
    handle.logger.child({ runId: "RUN-a" }),
    async () => {
      getLogger().info("step_started");
      entered.resolve();
      await release.promise;
      getLogger().info("step_completed", { outcome: "RUN-a" });
    },
  );
  await entered.promise;
  try {
    await withLogger(handle.logger.child({ runId: "RUN-b" }), async () => {
      getLogger().info("step_started");
      await Promise.resolve();
      getLogger().info("step_completed", { outcome: "RUN-b" });
    });
  } finally {
    release.resolve();
    await first;
    await handle.close();
  }
  const rows = (await readFile(handle.filePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((row) => row.event === "step_completed");
  assert.deepEqual(
    rows.map(({ runId, outcome }) => ({ runId, outcome })),
    [
      { runId: "RUN-b", outcome: "RUN-b" },
      { runId: "RUN-a", outcome: "RUN-a" },
    ],
  );
  assert.equal(getLogger().isLevelEnabled("info"), false);
});

test("built logger JSONL works with native pino-pretty options", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-log-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const handle = await openLog({ directory: root });
  handle.logger.info("step_completed", { durationMs: 12 });
  await handle.close();
  let text = "";
  const destination = new Writable({
    write(chunk, _encoding, done) {
      text += String(chunk);
      done();
    },
  });
  const output = pretty({
    destination,
    sync: true,
    colorize: false,
    messageKey: "event",
    hideObject: true,
    messageFormat: (row) => `${row.event} / ${row.durationMs} ms`,
  });
  await readLog(handle.filePath, { output });
  output.end();
  await finished(output);
  assert.match(text, /step_completed \/ 12 ms/u);
  assert.ok(!text.includes("\u001b"));
  const json = await readFile(handle.filePath, "utf8");
  assert.doesNotMatch(json, /"msg"/u);
});
