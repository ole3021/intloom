import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationReferences } from "./declaration-references.ts";

test("distinguishes module references from text and supports import types and reference directives", () => {
  const text = `
// import('ignored')
export type Text = "import('also-ignored')";
import type { A } from "one";
export { A } from 'two';
import "three";
export type B = import("four").B;
import X = require("five");
/// <reference path="./six.d.ts" />
/// <reference types="seven" />
`;
  const references = declarationReferences(text);
  assert.deepEqual(
    references.map((r) => [r.kind, r.specifier]).sort(),
    [
      ["module", "one"],
      ["module", "two"],
      ["module", "three"],
      ["module", "four"],
      ["module", "five"],
      ["path", "./six.d.ts"],
      ["types", "seven"],
    ].sort(),
  );
  for (const ref of references.filter((r) => r.kind === "module"))
    assert.equal(text.slice(ref.start + 1, ref.end - 1), ref.specifier);
});
