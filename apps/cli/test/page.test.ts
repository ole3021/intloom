import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { logPage } from "../src/ui/page.ts";
import { withPlainOutput } from "../src/ui/output-mode.ts";
import { formatServiceLog } from "../src/ui/service-log.ts";

function capture(tty: boolean) {
  let text = "";
  const stream = Object.assign(
    new Writable({
      write(chunk, _encoding, done) {
        text += chunk.toString();
        done();
      },
    }),
    { isTTY: tty, columns: 80, rows: 24 },
  ) as unknown as NodeJS.WriteStream;
  return { stream, text: () => text };
}

test("log pages append every entry to a plain file and keep pipes append-only", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "intloom-page-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { stream, text } = capture(false);
  const page = logPage(stream, directory, "startup");
  page.frame("Project /project\nData /data\nStarting");
  page.line("first record");
  page.frame("Project /project\nData /data\nOnline");
  for (let i = 0; i < 350; i++) page.line(`record ${i}`);
  page.line("last record");
  page.close();
  const saved = readFileSync(page.path, "utf8");
  assert.equal(saved, text().replace("Starting\n", "Starting\n\n"));
  assert.equal(saved.match(/Project/g)?.length, 1);
  assert.ok(saved.indexOf("first record") < saved.indexOf("last record"));
  for (let i = 0; i < 350; i++) assert.ok(saved.includes(`record ${i}\n`));
  assert.ok(!saved.includes("\x1b"));
  if (process.platform !== "win32")
    assert.equal(statSync(page.path).mode & 0o777, 0o600);
});

test("a live page bounds retained history, rerenders on resize and stops after close", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "intloom-page-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { stream, text } = capture(true);
  const page = logPage(stream, directory, "run-test");
  let firstDraws = 0,
    lastDraws = 0;
  page.frame(() => "Project /project\nData /data\nRunning");
  page.line(() => {
    firstDraws++;
    return "first record";
  });
  for (let i = 0; i < 350; i++) page.line(`record ${i}`);
  page.line((target) => {
    lastDraws++;
    return `last record at ${target.columns}`;
  });
  const oldFirst = firstDraws,
    oldLast = lastDraws;
  stream.columns = 44;
  stream.rows = 18;
  stream.emit("resize");
  if (page.dynamic) {
    assert.equal(firstDraws, oldFirst);
    assert.ok(lastDraws > oldLast);
  }
  page.close();
  const closed = text();
  await delay(180);
  assert.equal(text(), closed);
  assert.equal(stream.listenerCount("resize"), 0);
  const saved = readFileSync(page.path, "utf8");
  assert.ok(saved.includes("first record"));
  assert.ok(saved.includes("record 349"));
  assert.equal(saved.match(/last record/g)?.length, 1);
  assert.ok(!saved.includes("\x1b"));
  assert.ok(!saved.includes("Recent logs"));
});

test("plain log pages retain their mode for external host notifications and shutdown", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "intloom-page-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { stream, text } = capture(true);
  stream.columns = 24;
  const page = withPlainOutput(true, () =>
    logPage(stream, directory, "startup"),
  );
  page.frame("Kernel online");
  page.line((target) =>
    formatServiceLog(
      {
        time: "2026-11-05T00:00:00Z",
        level: "info",
        message: "x".repeat(150),
        data: { complete: true },
      },
      target,
    ),
  );
  page.close();
  assert.equal(page.dynamic, false);
  assert.equal(text().trim().split("\n").length, 2);
  assert.ok(!text().includes("\x1b"));
  assert.match(text(), /data=\{"complete":true\}/);
});
