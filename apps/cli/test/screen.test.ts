// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: This test runs directly under Node without Turbo caching.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { test } from "node:test";
import { createRequire } from "node:module";
const { Terminal } = createRequire(import.meta.url)(
  "@xterm/headless",
) as typeof import("@xterm/headless");
import { logPage } from "../src/ui/page.ts";

test("live pages survive terminal reflow and restore prior scrollback with one final snapshot", async (t) => {
  const oldCI = process.env.CI,
    oldTerm = process.env.TERM;
  delete process.env.CI;
  process.env.TERM = "xterm-256color";
  t.after(() => {
    if (oldCI === undefined) delete process.env.CI;
    else process.env.CI = oldCI;
    if (oldTerm === undefined) delete process.env.TERM;
    else process.env.TERM = oldTerm;
  });
  const directory = mkdtempSync(join(tmpdir(), "intloom-screen-"));
  const terminal = new Terminal({
    cols: 100,
    rows: 30,
    allowProposedApi: true,
  });
  t.after(() => {
    terminal.dispose();
    rmSync(directory, { recursive: true, force: true });
  });
  let bytes = "";
  const stream = Object.assign(
    new Writable({
      write(chunk, _encoding, done) {
        bytes += chunk.toString();
        done();
      },
    }),
    { isTTY: true, columns: 100, rows: 30 },
  ) as unknown as NodeJS.WriteStream;
  const flush = async () => {
    const next = bytes;
    bytes = "";
    // PTY output processing maps LF to CRLF before bytes reach the terminal.
    await new Promise<void>((resolve) =>
      terminal.write(next.replaceAll("\n", "\r\n"), resolve),
    );
  };
  const text = (all = false) => {
    const buffer = terminal.buffer.active;
    return Array.from(
      { length: all ? buffer.length : terminal.rows },
      (_, i) =>
        buffer
          .getLine(i + (all ? 0 : buffer.baseY))
          ?.translateToString(true, 0, terminal.cols) ?? "",
    ).join("\n");
  };
  stream.write("Previous shell output must survive\n");
  await flush();
  const page = logPage(stream, directory, "run-test");

  assert.equal(page.dynamic, true);
  page.frame(
    () =>
      `UNIQUE RUN HEADER\nCurrent width ${stream.columns}\n${stream.columns < 80 ? "short" : "path/".repeat(25)}`,
  );
  for (let i = 0; i < 50; i++) page.line(`Log entry ${i}`);
  for (const [columns, rows] of [
    [100, 30],
    [80, 24],
    [44, 24],
    [100, 30],
    [44, 18],
    [120, 40],
  ] as const) {
    terminal.resize(columns, rows);
    stream.columns = columns;
    stream.rows = rows;
    stream.emit("resize");
    await flush();
    assert.equal(terminal.buffer.active.type, "alternate");
    assert.equal(text().split("UNIQUE RUN HEADER").length, 2);
    assert.match(text(), new RegExp(`Current width ${columns}`));
    assert.ok(!text().includes("Previous shell output"));
    assert.ok(text().includes("Log entry 49"));
    if (columns < 80) assert.doesNotMatch(text(), /path/);
  }
  page.close(true);
  await flush();
  assert.equal(terminal.buffer.active.type, "normal");
  assert.match(text(true), /Previous shell output must survive/);
  assert.equal(text(true).split("UNIQUE RUN HEADER").length, 2);
  assert.match(text(true), /Current width 120/);
});
