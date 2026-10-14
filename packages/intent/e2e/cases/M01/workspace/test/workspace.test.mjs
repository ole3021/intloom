import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

test("the initial browser shell loads an existing native ESM entry", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const entry = /<script\b[^>]*type="module"[^>]*src="([^"]+)"/u.exec(html);
  assert.ok(entry, "A native ESM browser entry is required.");
  await access(new URL(`../${entry[1]}`, import.meta.url));
});
