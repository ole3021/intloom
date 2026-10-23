import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";
import { randomUUID } from "node:crypto";
import { Socket } from "node:net";
import type { Logger, LogFields } from "@intloom/utils";
import { modelErrorDiagnostics } from "./errors.ts";

type Observation = {
  active: boolean;
  requests: number;
  phase: string;
  cleanup: (() => void)[];
  emit: (event: string, fields?: LogFields) => void;
};
type RequestObservation = {
  owner: Observation;
  httpRequest: number;
  phase: string;
};
type Connection = { id: string; uses: number };
const context = new AsyncLocalStorage<Observation>();
const requests = new WeakMap<object, RequestObservation>();
const sockets = new WeakMap<object, Connection>();
let observers = 0;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function requestEvent(event: string, data: Record<string, unknown>) {
  if (!object(data.request)) return;
  const fields: Record<string, unknown> = {};
  if (event === "client:sendHeaders" && object(data.socket)) {
    // Count all observed uses, including requests outside a model call, so a
    // pooled connection is never labelled new merely because ownership changed.
    const connection = sockets.get(data.socket);
    fields.connectionUse = connection
      ? connection.uses++ === 0
        ? "new"
        : "reused"
      : "unknown";
    if (connection) fields.connectionId = connection.id;
  }
  if (event === "request:create") {
    const owner = context.getStore();
    if (!owner?.active) return;
    requests.set(data.request, {
      owner,
      httpRequest: ++owner.requests,
      phase: "request_created",
    });
  }
  const request = requests.get(data.request);
  if (!request?.owner.active) return;
  const { owner, httpRequest } = request;
  fields.httpRequest = httpRequest;
  if (event === "request:headers" && object(data.response)) {
    const status = data.response.statusCode;
    if (
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
    )
      fields.httpStatus = status;
  }
  if (event === "request:error") {
    Object.assign(fields, modelErrorDiagnostics(data.error), {
      lastPhase: request.phase,
    });
  }
  const phases: Record<string, string> = {
    "request:create": "request_created",
    "client:sendHeaders": "request_headers_sending",
    "request:bodySent": "request_body_sent",
    "request:headers": "response_headers",
    "request:trailers": "response_completed",
    "request:error": "request_failed",
  };
  request.phase = phases[event] ?? request.phase;
  owner.phase = request.phase;
  owner.emit(`model_http_${owner.phase}`, fields);
}

function connectionEvent(event: string, data: Record<string, unknown>) {
  const owner = context.getStore();
  let id: string | undefined;
  if (event === "client:connected" && object(data.socket)) {
    const connection = sockets.get(data.socket) ?? {
      id: randomUUID(),
      uses: 0,
    };
    sockets.set(data.socket, connection);
    id = connection.id;
  }
  // Pool connections can serve other concurrent requests. This records the
  // initiating async context; only sendHeaders binds a request to its socket.
  if (!owner?.active) return;
  owner.emit(
    event === "client:beforeConnect"
      ? "model_connection_started"
      : event === "client:connected"
        ? "model_connection_established"
        : "model_connection_failed",
    {
      ...(id ? { connectionId: id } : {}),
      association: "initiating_context",
      ...(event === "client:connected" && object(data.socket)
        ? { tls: data.socket.encrypted === true ? "established" : "not_used" }
        : {}),
      ...(event === "client:connectError"
        ? modelErrorDiagnostics(data.error)
        : {}),
    },
  );
}

function socketEvent(data: Record<string, unknown>) {
  const owner = context.getStore();
  const socket = data.socket;
  if (!owner?.active || !(socket instanceof Socket)) return;
  const connection = { id: randomUUID(), uses: 0 };
  sockets.set(socket, connection);
  const emit = (event: string, fields: LogFields = {}) => {
    try {
      owner.emit(event, {
        connectionId: connection.id,
        association: "initiating_context",
        ...fields,
      });
    } catch {
      /* Socket observers must not affect network execution. */
    }
  };
  const lookup = (error: unknown) =>
    emit(
      error ? "model_dns_failed" : "model_dns_resolved",
      modelErrorDiagnostics(error),
    );
  const connected = () => emit("model_tcp_connected");
  const secure = () => emit("model_tls_established");
  const closed = (hadError: boolean) =>
    emit("model_socket_closed", { hadError });
  socket.once("lookup", lookup);
  socket.once("connect", connected);
  socket.once("secureConnect", secure);
  socket.once("close", closed);
  owner.cleanup.push(() => {
    socket.off("lookup", lookup);
    socket.off("connect", connected);
    socket.off("secureConnect", secure);
    socket.off("close", closed);
  });
  emit("model_socket_created");
}

const subscriptions = [
  "request:create",
  "client:sendHeaders",
  "request:bodySent",
  "request:headers",
  "request:trailers",
  "request:error",
  "client:beforeConnect",
  "client:connected",
  "client:connectError",
].map((event) => ({
  channel: channel(`undici:${event}`),
  listener(data: unknown) {
    // Diagnostic subscribers execute inside the HTTP client and must never
    // change its outcome, including when the logging sink fails.
    try {
      if (!object(data)) return;
      if (
        event === "client:beforeConnect" ||
        event === "client:connected" ||
        event === "client:connectError"
      )
        connectionEvent(event, data);
      else requestEvent(event, data);
    } catch {
      /* Observation cannot fail a model request. */
    }
  },
}));
subscriptions.push({
  channel: channel("net.client.socket"),
  listener(data: unknown) {
    try {
      if (object(data)) socketEvent(data);
    } catch {
      /* Observation only. */
    }
  },
});

/** Passive Node fetch observations. No URLs, headers, bodies or socket mutation. */
export function observeConnection(log: Logger, fields: LogFields) {
  const started = performance.now();
  const owner: Observation = {
    active: true,
    requests: 0,
    phase: "unobserved",
    cleanup: [],
    emit(event, detail = {}) {
      if (owner.active)
        log.debug(event, {
          ...fields,
          ...detail,
          elapsedMs: Math.round(performance.now() - started),
        });
    },
  };
  if (observers++ === 0)
    for (const item of subscriptions) item.channel.subscribe(item.listener);
  return {
    run<T>(action: () => T): T {
      return context.run(owner, action);
    },
    summary() {
      return { httpRequests: owner.requests, lastHttpPhase: owner.phase };
    },
    close() {
      if (!owner.active) return;
      owner.active = false;
      for (const cleanup of owner.cleanup) cleanup();
      owner.cleanup.length = 0;
      if (--observers === 0)
        for (const item of subscriptions)
          item.channel.unsubscribe(item.listener);
    },
  };
}
