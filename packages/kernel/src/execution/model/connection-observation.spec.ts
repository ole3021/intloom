import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { test } from "node:test";
import { Socket } from "node:net";
import { silentLogger } from "@intloom/utils";
import { observeConnection } from "./connection-observation.ts";

test("HTTP observations retain request identity across concurrent contexts without exposing payloads", () => {
  const rows: Record<string, unknown>[] = [];
  const log = {
    ...silentLogger,
    debug: (event: string, fields?: Readonly<Record<string, unknown>>) => {
      rows.push({ event, ...fields });
    },
  };
  const first = observeConnection(log, { modelRequestId: "first" });
  const second = observeConnection(log, { modelRequestId: "second" });
  const publish = (event: string, value: unknown) =>
    channel(`undici:${event}`).publish(value);
  const a = { headers: "PRIVATE_HEADERS", path: "/PRIVATE_PATH" },
    b = {};
  const connection = { hostname: "PRIVATE_HOST" },
    socket = { encrypted: true };
  first.run(() => {
    publish("request:create", { request: a });
    publish("client:beforeConnect", { connectParams: connection });
  });
  second.run(() => publish("request:create", { request: b }));
  first.run(() =>
    publish("client:connected", { connectParams: { ...connection }, socket }),
  );
  publish("client:sendHeaders", {
    request: b,
    socket,
    headers: "PRIVATE_HEADERS",
  });
  publish("client:sendHeaders", { request: a, socket });
  publish("request:headers", {
    request: b,
    response: { statusCode: 200, headers: ["PRIVATE_RESPONSE"] },
  });
  publish("request:error", {
    request: a,
    error: Object.assign(new Error("PRIVATE_ERROR"), { code: "ECONNRESET" }),
  });
  assert.equal(
    rows.find((r) => r.event === "model_http_request_failed")?.modelRequestId,
    "first",
  );
  assert.equal(
    rows.find((r) => r.event === "model_http_response_headers")?.modelRequestId,
    "second",
  );
  assert.equal(
    rows.find((r) => r.event === "model_connection_established")?.association,
    "initiating_context",
  );
  assert.equal(
    rows.find((r) => r.event === "model_connection_established")?.tls,
    "established",
  );
  const sends = rows.filter(
    (r) => r.event === "model_http_request_headers_sending",
  );
  assert.deepEqual(
    sends.map((r) => r.connectionUse),
    ["new", "reused"],
  );
  assert.equal(
    rows.find((r) => r.event === "model_http_request_failed")?.lastPhase,
    "request_headers_sending",
  );
  first.close();
  second.close();
  const count = rows.length;
  publish("request:error", { request: a, error: new Error("late") });
  assert.equal(rows.length, count);
  assert.equal(JSON.stringify(rows).includes("PRIVATE_"), false);
});

test("a connection previously used outside the model context is reported as reused", () => {
  const rows: Record<string, unknown>[] = [];
  const observation = observeConnection(
    {
      ...silentLogger,
      debug: (event, fields) => {
        rows.push({ event, ...fields });
      },
    },
    {},
  );
  const socket = {},
    request = {};
  channel("undici:client:connected").publish({ socket });
  channel("undici:client:sendHeaders").publish({ socket, request: {} });
  observation.run(() => channel("undici:request:create").publish({ request }));
  channel("undici:client:sendHeaders").publish({ socket, request });
  assert.equal(
    rows.find((row) => row.event === "model_http_request_headers_sending")
      ?.connectionUse,
    "reused",
  );
  observation.close();
});

test("observation never throws into the client and ignores requests outside its context", () => {
  const requestChannel = channel("undici:request:create");
  const previous = requestChannel.hasSubscribers;
  const observation = observeConnection(
    {
      ...silentLogger,
      debug: () => {
        throw new Error("logging unavailable");
      },
    },
    {},
  );
  assert.doesNotThrow(() =>
    observation.run(() => requestChannel.publish({ request: {} })),
  );
  requestChannel.publish({ request: {} });
  assert.equal(observation.summary().httpRequests, 1);
  observation.close();
  observation.close();
  assert.equal(requestChannel.hasSubscribers, previous);
});

test("socket phase listeners record only safe metadata and detach at observation end", () => {
  const rows: Record<string, unknown>[] = [];
  const observation = observeConnection(
    {
      ...silentLogger,
      debug: (event, fields) => {
        rows.push({ event, ...fields });
      },
    },
    {},
  );
  const socket = new Socket();
  const before = socket.listenerCount("close");
  observation.run(() => channel("net.client.socket").publish({ socket }));
  socket.emit("lookup", null, "PRIVATE_ADDRESS", 4, "PRIVATE_HOST");
  socket.emit("connect");
  socket.emit("secureConnect");
  assert.deepEqual(
    rows.map((row) => row.event),
    [
      "model_socket_created",
      "model_dns_resolved",
      "model_tcp_connected",
      "model_tls_established",
    ],
  );
  assert.equal(JSON.stringify(rows).includes("PRIVATE_"), false);
  assert.equal(socket.listenerCount("close"), before + 1);
  observation.close();
  assert.equal(socket.listenerCount("close"), before);
  socket.destroy();
});
