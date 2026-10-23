import { deferred } from "../../test/deferred.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { getLogger, silentLogger, withLogger } from "./context.ts";

test("overlapping asynchronous calls retain independent loggers and restore the outer context", async () => {
  const first = { ...silentLogger };
  const second = { ...silentLogger };
  const entered = deferred();
  const release = deferred();
  const pending = withLogger(first, async () => {
    assert.equal(getLogger(), first);
    entered.resolve();
    await release.promise;
    assert.equal(getLogger(), first);
  });
  await entered.promise;
  try {
    await withLogger(second, async () => {
      await Promise.resolve();
      assert.equal(getLogger(), second);
    });
    assert.equal(getLogger(), silentLogger);
  } finally {
    release.resolve();
    await pending;
  }
});

test("nested context restores its parent after an exception", () => {
  const outer = { ...silentLogger };
  const inner = { ...silentLogger };
  withLogger(outer, () => {
    assert.throws(
      () =>
        withLogger(inner, () => {
          assert.equal(getLogger(), inner);
          throw new Error("fixture failure");
        }),
      /fixture failure/,
    );
    assert.equal(getLogger(), outer);
  });
  assert.equal(getLogger(), silentLogger);
});
