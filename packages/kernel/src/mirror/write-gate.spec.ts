import assert from "node:assert/strict";
import { test } from "node:test";
import { createWriteGate } from "./write-gate.ts";
import { setImmediate } from "node:timers/promises";

test("capture write gate waits for already admitted work and rejects new writes during capture", async () => {
  const gate = createWriteGate();
  let release!: () => void;
  const accepted = new Promise<void>((r) => {
    release = r;
  });
  let settled = false;
  const project = gate.project({
    snapshot: async () => ({}),
    read: async () => "",
    write: async () => {
      await accepted;
      settled = true;
    },
    remove: async () => {},
    run: async () => {
      throw new Error("unused");
    },
  });
  const write = project.write("x", "value");
  const capture = gate.capture(async () => {
    assert.equal(settled, true);
    assert.throws(() => gate.assertOpen(), { code: "BUSY" });
  });
  await setImmediate();
  release();
  await Promise.all([write, capture]);
  gate.assertOpen();
});
