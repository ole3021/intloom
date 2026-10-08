import assert from "node:assert/strict";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path, { dirname, resolve } from "node:path";
import { describe, test } from "node:test";
import { LoomError } from "@intloom/utils";
import { isPathWithin, resolveReference } from "./references.ts";

describe("resource references", () => {
  const root = resolve(tmpdir(), "reference-package");
  for (const [reference, path, kind, exportName] of [
    ["@stages/main", "stages/main.yaml", "stage", "default"],
    ["@stages/main.yaml", "stages/main.yaml", "stage", "default"],
    ["@agents/reviewer", "agents/reviewer.md", "agent", "default"],
    ["@skills/review", "skills/review/SKILL.md", "skill", "default"],
    ["@skills/review/SKILL.md", "skills/review/SKILL.md", "skill", "default"],
    ["@codes/nested/run", "codes/nested/run.ts", "code", "default"],
    ["@codes/run.ts:execute", "codes/run.ts", "code", "execute"],
    ["@schemas/state:stateSchema", "schemas/state.ts", "schema", "stateSchema"],
    ["@tools/search", "tools/search.ts", "tool", "default"],
    [
      "@initializers/state:seed",
      "initializers/state.ts",
      "initializer",
      "seed",
    ],
  ] as const) {
    test(`resolves ${reference}`, () => {
      assert.deepEqual(resolveReference(root, reference), {
        file: resolve(root, path),
        kind,
        exportName,
      });
    });
  }

  for (const reference of [
    "@unknown/run",
    "codes/run",
    "@codes/../outside",
    "@codes/nested\\run",
    "@codes/run.d.ts",
    "@codes/run:bad-name",
    "@agents/reviewer:default",
    "@skills/review:default",
    "@stages/main:default",
  ] as const) {
    test(`rejects invalid reference ${reference}`, () => {
      assert.throws(
        () => resolveReference(root, reference),
        (error) => LoomError.is(error) && error.code === "INVALID_REFERENCE",
      );
    });
  }

  test("isPathWithin distinguishes descendants from parents and sibling prefixes", () => {
    assert.equal(isPathWithin(root, root), true);
    assert.equal(isPathWithin(root, resolve(root, "codes/run.ts")), true);
    assert.equal(isPathWithin(root, dirname(root)), false);
    assert.equal(isPathWithin(root, `${root}-other/file.ts`), false);
  });
});

for (const [name, platform, root] of [
  ["POSIX", path.posix, "/package"],
  ["Windows", path.win32, "C:\\package"],
] as const) {
  test(`checks ${name} path boundaries with native separators`, (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(path, "sep");
    assert.ok(descriptor);
    t.mock.method(path, "relative", platform.relative);
    t.mock.method(path, "isAbsolute", platform.isAbsolute);
    Object.defineProperty(path, "sep", { ...descriptor, value: platform.sep });
    syncBuiltinESMExports();
    t.after(() => {
      t.mock.restoreAll();
      Object.defineProperty(path, "sep", descriptor);
      syncBuiltinESMExports();
    });
    for (const [file, expected] of [
      [root, true],
      [platform.resolve(root, "codes/run.ts"), true],
      [platform.resolve(root, ".."), false],
      [platform.resolve(root, "../outside/run.ts"), false],
      [platform.resolve(`${root}-other`, "run.ts"), false],
      [platform.resolve(root, "..hidden/run.ts"), true],
      ...(name === "Windows" ? [["D:\\package\\run.ts", false] as const] : []),
    ] as const) {
      assert.equal(isPathWithin(root, file), expected, file);
    }
  });
}
