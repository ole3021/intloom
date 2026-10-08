import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectModule } from "./inspect-module.ts";

for (const [name, source] of [
  ["anonymous function", "export default function () {}"],
  ["identifier", "const run = () => {}; export default run;"],
  [
    "object destructuring",
    "const { run } = { run: () => {} }; export default run;",
  ],
  ["array destructuring", "const [run] = [() => {}]; export default run;"],
  ["defaulted binding", "const [run = () => {}] = []; export default run;"],
  ["export alias", "function run() {} export { run as default };"],
] as const) {
  test(`recognizes a default export backed by ${name}`, () => {
    assert.deepEqual(inspectModule(source, "resource.js"), {
      exports: new Set(["default"]),
      imports: new Set(),
      forwarded: new Set(),
    });
  });
}
