import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("compiled application runs in Node.js with its workspace dependency", () => {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const output = execFileSync("node", [entry], { encoding: "utf8" });

  assert.equal(output.trim(), "Hello, intloom!");
});
