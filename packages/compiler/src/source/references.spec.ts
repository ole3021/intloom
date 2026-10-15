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
    ["./stages/main.yaml", "stages/main.yaml", "stage", "default"],
    ["./agents/reviewer.md", "agents/reviewer.md", "agent", "default"],
    ["./skills/review/SKILL.md", "skills/review/SKILL.md", "skill", "default"],
    ["./codes/nested/run.ts", "codes/nested/run.ts", "code", "default"],
    ["./codes/run.ts#execute", "codes/run.ts", "code", "execute"],
    [
      "./schemas/state.ts#stateSchema",
      "schemas/state.ts",
      "schema",
      "stateSchema",
    ],
    ["./tools/search.ts", "tools/search.ts", "tool", "default"],
    [
      "./initializers/state.ts#seed",
      "initializers/state.ts",
      "initializer",
      "seed",
    ],
  ] as const)
    test(`resolves ${reference}`, () => {
      assert.deepEqual(resolveReference(root, reference, kind), {
        file: resolve(root, path),
        kind,
        exportName,
      });
    });
  for (const reference of [
    "@codes/run",
    "codes/run.ts",
    "../outside.ts",
    "./codes/run.d.ts",
    "./codes/run.ts#bad-name",
    "./codes/run.ts#",
    "./codes/a\\b.ts",
  ])
    test(`rejects ${reference}`, () =>
      assert.throws(
        () => resolveReference(root, reference, "code"),
        (e) => LoomError.is(e) && e.code === "INVALID_REFERENCE",
      ));
  test("resolves resources relative to their declaring Stage, independently of folder names", () => {
    assert.equal(
      resolveReference(
        root,
        "./schema/value.ts",
        "tool",
        resolve(root, "stages/main/stage.yaml"),
      ).file,
      resolve(root, "stages/main/schema/value.ts"),
    );
    assert.throws(() =>
      resolveReference(root, "./agents/a.md#default", "agent"),
    );
  });

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
