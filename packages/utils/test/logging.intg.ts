import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { test } from "node:test";
import pretty from "pino-pretty";
import { openLog, readLog } from "@intloom/utils";

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
