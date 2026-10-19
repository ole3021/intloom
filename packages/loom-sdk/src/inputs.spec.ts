import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ZodError } from "zod";
import { parseLoomInput, type LoomInputKind } from "./inputs.ts";

test("accepts only declared fixed inputs and detaches caller-owned arrays", () => {
  const input = {
    prompt: "  Keep original text  ",
    files: ["file.ts"],
    dirs: ["src"],
    urls: ["https://example.com"],
  };
  const parsed = parseLoomInput(["prompt", "files", "dirs", "urls"], input);
  assert.deepEqual(parsed, input);
  input.files.push("later.ts");
  input.dirs[0] = "later";
  input.urls.length = 0;
  assert.deepEqual(parsed.files, ["file.ts"]);
  assert.deepEqual(parsed.dirs, ["src"]);
  assert.deepEqual(parsed.urls, ["https://example.com"]);
});

test("an input-free Loom accepts absent slots and omits explicit undefined", () => {
  assert.deepEqual(parseLoomInput([], {}), {});
  assert.deepEqual(parseLoomInput([], { prompt: undefined }), {});
});

test("rejects repeated input declarations", () => {
  assert.throws(
    () => parseLoomInput(["prompt", "prompt"], { prompt: "hello" }),
    /unique/,
  );
});

describe("declared input slots", () => {
  for (const [kind, value] of [
    ["prompt", "original text"],
    ["files", ["missing-file.ts"]],
    ["dirs", ["missing-directory"]],
    ["urls", ["https://example.invalid/reference"]],
  ] as const) {
    test(`${kind} is required exactly when declared; references are not resolved`, () => {
      assert.deepEqual(parseLoomInput([kind], { [kind]: value }), {
        [kind]: value,
      });
      assert.throws(() => parseLoomInput([kind], {}), {
        message: `Loom input ${kind} is required.`,
      });
      assert.throws(() => parseLoomInput([], { [kind]: value }), {
        message: `Loom does not accept input ${kind}.`,
      });
    });
  }
});

describe("input value validation", () => {
  for (const { name, kind, value, path } of [
    { name: "blank prompt", kind: "prompt", value: " \t\n", path: ["prompt"] },
    { name: "non-text prompt", kind: "prompt", value: 1, path: ["prompt"] },
    { name: "empty file list", kind: "files", value: [], path: ["files"] },
    {
      name: "blank file reference",
      kind: "files",
      value: [""],
      path: ["files", 0],
    },
    { name: "empty directory list", kind: "dirs", value: [], path: ["dirs"] },
    {
      name: "blank directory reference",
      kind: "dirs",
      value: [" "],
      path: ["dirs", 0],
    },
    { name: "empty URL list", kind: "urls", value: [], path: ["urls"] },
    {
      name: "malformed URL",
      kind: "urls",
      value: ["not a URL"],
      path: ["urls", 0],
    },
  ] satisfies {
    name: string;
    kind: LoomInputKind;
    value: unknown;
    path: (string | number)[];
  }[]) {
    test(`rejects ${name} at its own field`, () => {
      assert.throws(
        () => parseLoomInput([kind], { [kind]: value }),
        (error) => {
          assert.ok(error instanceof ZodError);
          assert.deepEqual(
            error.issues.map((issue) => issue.path),
            [path],
          );
          return true;
        },
      );
    });
  }

  test("rejects obsolete or arbitrary input fields", () => {
    assert.throws(
      () => parseLoomInput([], { intent: "old input" }),
      (error) => {
        assert.ok(error instanceof ZodError);
        assert.equal(error.issues[0]?.code, "unrecognized_keys");
        return true;
      },
    );
  });
});
