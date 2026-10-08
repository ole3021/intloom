import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isLoomError, LoomError } from "./loom-error.ts";

const brand = Symbol.for("@intloom/LoomError");
const branded = {
  [brand]: true,
  name: "LoomError",
  code: "BUSY",
  message: "Project is busy.",
  retryable: true,
};

describe("LoomError constructor", () => {
  test("creates a LoomError with only code and message", () => {
    const error = new LoomError("NOT_FOUND", "Run was not found.");

    assert.equal(error.name, "LoomError");
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.message, "Run was not found.");
    assert.equal(error.retryable, false);
    assert.equal(error.cause, undefined);
    assert.ok(error instanceof Error);
    assert.ok(error instanceof LoomError);
  });

  test("stores retryability and an arbitrary reason in cause", () => {
    const cause = { operation: "save", runId: "run-1" };
    const error = new LoomError("STORAGE_ERROR", "Failed to save run.", {
      retryable: true,
      cause,
    });

    assert.equal(error.retryable, true);
    assert.equal(error.cause, cause);
  });
});

describe("LoomError.from", () => {
  test("converts a standard Error and preserves it as cause", () => {
    const original = new Error("connection closed");
    const error = LoomError.from(original, {
      code: "STORAGE_ERROR",
      message: "The storage operation failed.",
      retryable: true,
    });

    assert.equal(error.code, "STORAGE_ERROR");
    assert.equal(error.message, "The storage operation failed.");
    assert.equal(error.retryable, true);
    assert.equal(error.cause, original);
  });

  for (const [label, cause] of [
    ["string", "failure"],
    ["object", { reason: "failure" }],
    ["null", null],
    ["undefined", undefined],
    ["number", 0],
    ["boolean", false],
  ] as const) {
    test(`preserves unknown ${label} cause and defaults retryable to false`, () => {
      const error = LoomError.from(cause, { code: "BUSY", message: "Busy." });
      assert.equal(error.code, "BUSY");
      assert.equal(error.message, "Busy.");
      assert.equal(error.retryable, false);
      assert.equal(error.cause, cause);
    });
  }

  test("keeps the same LoomError when its code matches the fallback", () => {
    const cause = new Error("lock timeout");
    const original = new LoomError("BUSY", "Already running.", {
      retryable: true,
      cause,
    });

    const converted = LoomError.from(original, {
      code: "BUSY",
      message: "Fallback message.",
      retryable: false,
    });

    assert.equal(converted, original);
    assert.equal(converted.message, "Already running.");
    assert.equal(converted.retryable, true);
    assert.equal(converted.cause, cause);
  });

  test("wraps a LoomError when mapping it to a different code", () => {
    const original = new LoomError("BUSY", "Already running.", {
      retryable: true,
    });

    const converted = LoomError.from(original, {
      code: "KERNEL_UNAVAILABLE",
      message: "The kernel is unavailable.",
      retryable: false,
    });

    assert.notEqual(converted, original);
    assert.equal(converted.code, "KERNEL_UNAVAILABLE");
    assert.equal(converted.message, "The kernel is unavailable.");
    assert.equal(converted.retryable, false);
    assert.equal(converted.cause, original);
  });
});

describe("LoomError recognition", () => {
  test("rejects revoked proxies and failing prototype inspection without throwing", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const failing = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("Cannot inspect prototype.");
        },
      },
    );
    for (const value of [revoked.proxy, failing]) {
      assert.equal(LoomError.is(value), false);
      assert.equal(isLoomError(value), false);
      const converted = LoomError.from(value, {
        code: "BUSY",
        message: "Fallback.",
      });
      assert.equal(converted.code, "BUSY");
      assert.equal(converted.cause, value);
    }
  });

  test("rejects branded fields whose accessors throw", () => {
    for (const key of [brand, "name", "code", "message", "retryable"]) {
      const value = Object.defineProperty({ ...branded }, key, {
        get() {
          throw new Error("Cannot inspect field.");
        },
      });
      assert.equal(LoomError.is(value), false);
      assert.equal(
        LoomError.from(value, { code: "BUSY", message: "Fallback." }).cause,
        value,
      );
    }
  });

  test("from wraps a cause if its code fails after successful recognition", () => {
    let reads = 0;
    const cause = Object.defineProperty({ ...branded }, "code", {
      get() {
        if (++reads > 1) throw new Error("Code is no longer readable.");
        return "BUSY";
      },
    });
    const converted = LoomError.from(cause, {
      code: "BUSY",
      message: "Fallback.",
    });
    assert.notEqual(converted, cause);
    assert.equal(converted.message, "Fallback.");
    assert.equal(converted.cause, cause);
  });

  test("recognizes branded values from another copy and preserves matching ones", () => {
    assert.equal(branded instanceof LoomError, false);
    assert.ok(LoomError.is(branded));
    assert.equal(
      LoomError.from(branded, { code: "BUSY", message: "Fallback." }),
      branded,
    );
  });

  for (const [label, value] of [
    ["undefined", undefined],
    ["null", null],
    ["boolean", false],
    ["number", 0],
    ["string", "error"],
    ["symbol", Symbol("error")],
    ["plain object", {}],
    ["standard Error", new Error()],
  ] as const) {
    test(`rejects non-LoomError input: ${label}`, () => {
      assert.equal(LoomError.is(value), false);
    });
  }

  for (const [label, key, invalid] of [
    ["brand", brand, "true"],
    ["name", "name", "Error"],
    ["code", "code", 1],
    ["message", "message", 1],
    ["retryable", "retryable", "true"],
  ] as const) {
    test(`rejects missing or invalid branded field ${label}`, () => {
      const missing: Record<PropertyKey, unknown> = { ...branded };
      delete missing[key];
      for (const value of [missing, { ...branded, [key]: invalid }]) {
        assert.equal(LoomError.is(value), false);
      }
    });
  }
});

test("isLoomError recognizes instances and cross-copy values while rejecting invalid input", () => {
  assert.equal(isLoomError(new LoomError("BUSY", "Busy.")), true);
  assert.equal(isLoomError(branded), true);
  assert.equal(isLoomError({ ...branded, name: "Error" }), false);
});
