import assert from "node:assert/strict";
import { test } from "node:test";
import { defineErrorCatalog } from "./error-catalog.ts";
import { LoomError } from "./loom-error.ts";

const errors = defineErrorCatalog({
  NOT_FOUND: {
    message: "The requested resource was not found.",
  },
  BUSY: {
    message: "The requested resource is busy.",
    retryable: true,
  },
});

test("applies defaults and throw-site overrides", () => {
  const defaultError = errors.create("NOT_FOUND");
  assert.equal(defaultError.code, "NOT_FOUND");
  assert.equal(defaultError.message, "The requested resource was not found.");
  assert.equal(defaultError.retryable, false);

  const cause = new Error("lookup failed");
  const overridden = errors.create("NOT_FOUND", {
    message: "Run run-1 was not found.",
    retryable: true,
    cause,
  });
  assert.equal(overridden.message, "Run run-1 was not found.");
  assert.equal(overridden.retryable, true);
  assert.equal(overridden.cause, cause);
  assert.equal(errors.create("BUSY", { message: "" }).message, "");
});

test("wraps causes with defaults and explicit overrides", () => {
  const cause = new Error("lock timeout");
  const defaultError = errors.wrap("BUSY", cause);
  assert.equal(defaultError.message, "The requested resource is busy.");
  assert.equal(defaultError.retryable, true);
  assert.equal(defaultError.cause, cause);

  const wrapped = errors.wrap("BUSY", cause, {
    message: "Project example is still running.",
    retryable: false,
  });
  assert.equal(wrapped.code, "BUSY");
  assert.equal(wrapped.message, "Project example is still running.");
  assert.equal(wrapped.retryable, false);
  assert.equal(wrapped.cause, cause);
});

test("identifies only LoomError values with a defined code", () => {
  assert.ok(errors.is(errors.create("BUSY")));
  assert.ok(
    errors.is({
      [Symbol.for("@intloom/LoomError")]: true,
      name: "LoomError",
      code: "BUSY",
      message: "Project is busy.",
      retryable: true,
    }),
  );
  for (const code of ["OTHER", "toString", "constructor", "__proto__"]) {
    assert.equal(errors.is(new LoomError(code, "Other error.")), false);
  }
});

test("recognition rejects revoked proxies and codes that fail after inspection", () => {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.equal(errors.is(revoked.proxy), false);
  let reads = 0;
  const value = {
    [Symbol.for("@intloom/LoomError")]: true,
    name: "LoomError",
    get code() {
      if (++reads > 1) throw new Error("Code is no longer readable.");
      return "BUSY";
    },
    message: "Busy.",
    retryable: true,
  };
  assert.equal(errors.is(value), false);
});

test("throws a defined LoomError by code", () => {
  const cause = new Error("lock timeout");
  assert.throws(
    () => errors.throw("BUSY", { message: "Project is locked.", cause }),
    (error) =>
      error instanceof LoomError &&
      error.code === "BUSY" &&
      error.message === "Project is locked." &&
      error.retryable === true &&
      error.cause === cause,
  );
});

for (const code of ["UNKNOWN", "toString", "constructor", "__proto__"]) {
  test(`rejects undefined code ${code} through every creation API`, () => {
    const calls = [
      // @ts-expect-error Verify runtime input that bypasses the static type contract.
      () => errors.create(code),
      // @ts-expect-error Verify runtime input that bypasses the static type contract.
      () => errors.wrap(code, null),
      // @ts-expect-error Verify runtime input that bypasses the static type contract.
      () => errors.throw(code),
    ];
    for (const call of calls) {
      assert.throws(call, {
        name: "TypeError",
        message: `[LoomError] Unknown error code: ${code}`,
      });
    }
  });
}

test("accepts an explicitly defined key even when Object.prototype has it", () => {
  const catalog = defineErrorCatalog({
    ["__proto__"]: { message: "Defined." },
  });
  const error = catalog.create("__proto__");
  assert.equal(error.message, "Defined.");
  assert.ok(catalog.is(error));
});
