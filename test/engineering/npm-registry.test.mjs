import assert from "node:assert/strict";
import { test } from "node:test";
import timers from "node:timers/promises";
import { lookupRegistry } from "../../.github/scripts/npm-registry.mjs";

const registry = "https://registry.example";
const name = "@intloom/loom-sdk";
const version = "0.4.0";

function registryClock(t) {
  let elapsed = 0;
  t.mock.method(console, "log", () => {});
  t.mock.method(Date, "now", () => elapsed);
  t.mock.method(timers, "setTimeout", async (ms) => {
    elapsed += ms;
  });
  return () => elapsed;
}

test("npm metadata can appear minutes after acceptance", async (t) => {
  const elapsed = registryClock(t);
  t.mock.method(globalThis, "fetch", async () =>
    elapsed() < 120_000
      ? new Response(null, { status: 404 })
      : Response.json({ version }),
  );
  assert.equal(await lookupRegistry(registry, name, version), undefined);
  assert.equal(
    (await lookupRegistry(registry, name, version, version)).version,
    version,
  );
  assert.ok(elapsed() >= 120_000);
});

test("npm readback retries rate limits, server errors and stale distribution tags", async (t) => {
  const elapsed = registryClock(t);
  const responses = [
    new Response(null, { status: 429, headers: { "Retry-After": "90" } }),
    new Response(null, { status: 503 }),
    Response.json({ version: "0.3.0" }),
    Response.json({ version }),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  assert.equal(
    (await lookupRegistry(registry, name, "latest", version)).version,
    version,
  );
  assert.ok(elapsed() >= 90_000);
});

test("npm visibility timeout identifies the package and permanent errors fail immediately", async (t) => {
  const elapsed = registryClock(t);
  const request = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 403 }),
  );
  await assert.rejects(
    lookupRegistry(registry, name, version),
    /loom-sdk@0\.4\.0 failed: HTTP 403/,
  );
  assert.equal(elapsed(), 0);
  request.mock.mockImplementation(
    async () => new Response(null, { status: 404 }),
  );
  await assert.rejects(
    lookupRegistry(registry, name, version, version),
    /Timed out reading @intloom\/loom-sdk@0\.4\.0.*404/,
  );
  assert.equal(elapsed(), 600_000);
});
