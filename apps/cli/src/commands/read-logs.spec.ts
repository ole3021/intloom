import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { openLog } from "@intloom/utils";
import { readProjectLogs } from "./read-logs.ts";

test("following service logs drains the preceding file and switches after restart without duplicate lines", {
  timeout: 5000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-follow-service-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await openLog({ directory });
  t.after(() => first.close());
  first.logger.info("before_restart");
  const rows: Record<string, unknown>[] = [];
  const controller = new AbortController();
  const output = new Writable({
    write(chunk, _encoding, done) {
      const row = JSON.parse(String(chunk));
      rows.push(row);
      if (row.event === "after_restart") controller.abort();
      done();
    },
  });
  const task = readProjectLogs(directory, {
    output,
    follow: true,
    signal: controller.signal,
    level: "debug",
  });
  t.after(() => {
    controller.abort();
    return task;
  });
  while (!rows.some((row) => row.event === "before_restart"))
    await setTimeout(10);
  first.logger.info("last_old_event");
  await first.close();
  const second = await openLog({ directory });
  t.after(() => second.close());
  second.logger.info("after_restart");
  await task;
  await second.close();
  assert.deepEqual(
    rows.map((row) => row.event),
    [
      "log_opened",
      "before_restart",
      "last_old_event",
      "log_closed",
      "log_opened",
      "after_restart",
    ],
  );
  assert.equal(output.destroyed, false);
});
