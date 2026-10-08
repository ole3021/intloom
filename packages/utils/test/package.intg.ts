import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defineErrorCatalog,
  generateId,
  isLoomError,
  LoomError,
} from "@intloom/utils";

test("loads the built package through its public entry", () => {
  const errors = defineErrorCatalog({
    TEST_ERROR: { message: "Test error." },
  });
  const error = errors.create("TEST_ERROR");

  assert.ok(error instanceof LoomError);
  assert.ok(isLoomError(error));
});

test("loads the ID generator and nanoid dependency through the built package", () => {
  assert.equal(
    import.meta.resolve("@intloom/utils"),
    new URL("../dist/index.js", import.meta.url).href,
  );
  assert.match(generateId("CODE", 12), /^CODE-[\w-]{12}$/);
});
