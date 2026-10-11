import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { test } from "node:test";
import { createTerminalUi } from "./terminal.ts";
import { createLogDisplay } from "./logs.ts";

function capture() {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, done) {
      text += String(chunk);
      done();
    },
  });
  return { stream, text: () => text };
}

test("terminal color follows the explicit flag and JSON remains unstyled", () => {
  for (const color of [false, true]) {
    for (const json of [false, true]) {
      const output = capture();
      const error = capture();
      const ui = createTerminalUi({
        input: Readable.from([]),
        output: output.stream,
        error: error.stream,
        interactive: false,
        json,
        color,
      });
      ui.error({ code: "FAILURE" }, "Failed");
      ui.note("Context");
      if (json) {
        assert.equal(output.text(), '{"code":"FAILURE"}\n');
        assert.equal(error.text(), "");
      } else if (color) {
        assert.ok(error.text().includes("\u001b[31mFailure\u001b[39m"));
        assert.ok(error.text().includes("\u001b[2mContext\u001b[22m"));
      } else {
        assert.equal(error.text(), "Failure · Failed\nContext\n");
      }
    }
  }
});

test("log color distinguishes errors and warnings only when enabled", async () => {
  for (const color of [false, true]) {
    const error = capture();
    const display = createLogDisplay(error.stream, color, false);
    for (const level of [30, 40, 50]) {
      display.output.write(JSON.stringify({ level, event: "run_update" }));
    }
    display.output.end();
    await finished(display.output);
    if (color) {
      assert.ok(error.text().includes("\u001b[33m--:--:-- WARN"));
      assert.ok(error.text().includes("\u001b[31m--:--:-- ERROR"));
      assert.equal(error.text().split("\n")[0]?.includes("\u001b"), false);
    } else {
      assert.equal(error.text().includes("\u001b"), false);
      assert.match(error.text(), /INFO.*\n.*WARN.*\n.*ERROR/u);
    }
  }
});
