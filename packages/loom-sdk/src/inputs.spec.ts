import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLoomInput } from "./inputs.ts";

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
  assert.deepEqual(parseLoomInput([], {}), {});
  assert.deepEqual(parseLoomInput([], { prompt: undefined }), {});
});

test("rejects missing, extra, repeated and invalid input slots", () => {
  assert.throws(() => parseLoomInput(["prompt"], {}), /required/);
  assert.throws(
    () => parseLoomInput([], { prompt: "hello" }),
    /does not accept/,
  );
  assert.throws(
    () => parseLoomInput(["prompt", "prompt"], { prompt: "hello" }),
    /unique/,
  );
  for (const input of [
    { prompt: " " },
    { files: [] },
    { files: [""] },
    { dirs: [" "] },
    { urls: ["not a URL"] },
    { intent: "old input" },
  ])
    assert.throws(() => parseLoomInput([], input));
});
