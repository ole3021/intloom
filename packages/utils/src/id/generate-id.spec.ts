import assert from "node:assert/strict";
import { test } from "node:test";
import { LoomError } from "../error/index.ts";
import { generateId } from "./generate-id.ts";

test("uses a 21-character random suffix by default and preserves prefix case", () => {
  const code: `CODE-${string}` = generateId("CODE");
  assert.match(code, /^CODE-[\w-]{21}$/);
  assert.match(generateId("AGENT"), /^AGENT-[\w-]{21}$/);
  assert.match(generateId("custom_prefix"), /^custom_prefix-[\w-]{21}$/);
  assert.match(generateId("code"), /^code-[\w-]{21}$/);
});

test("size controls only the random suffix", () => {
  for (const size of [1, 8, 32]) {
    const id = generateId("CODE", size);
    assert.equal(id.length, "CODE-".length + size);
    assert.match(id.slice("CODE-".length), /^[\w-]+$/);
  }
});

test("rejects empty and whitespace-containing prefixes with LoomError", () => {
  for (const prefix of ["", " ", " CODE", "CODE ", "CODE AGENT", "CODE\n"]) {
    assert.throws(
      () => generateId(prefix),
      (error) =>
        error instanceof LoomError && error.code === "INVALID_ID_PREFIX",
    );
  }
});

test("rejects invalid suffix sizes with LoomError", () => {
  for (const size of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => generateId("CODE", size),
      (error) => error instanceof LoomError && error.code === "INVALID_ID_SIZE",
    );
  }
});
