import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join, resolve } from "node:path";
import { IntloomError } from "@intloom/loom-sdk";
import {
  maximumBytes,
  type Endpoint,
  type Reply,
  type ServiceMethods,
  type ClientMethods,
  type ServiceClient,
  type CallArguments,
} from "./protocol.ts";

export function requestService<M extends keyof ServiceMethods>(
  dataDir: string,
  method: M,
  ...[params, signal]: CallArguments<Parameters<ServiceMethods[M]>>
): ReturnType<ServiceMethods[M]> {
  return request(dataDir, method, params, signal) as ReturnType<
    ServiceMethods[M]
  >;
}

export function createServiceClient(
  dataDir: string,
  projectDir?: string,
): ServiceClient {
  const project = projectDir ? resolve(projectDir) : undefined;
  return <M extends keyof ClientMethods>(
    method: M,
    ...[input, signal]: CallArguments<Parameters<ClientMethods[M]>>
  ) => {
    const params = input ?? [];
    const scoped = method === "createRun" ? [params[0], project] : params;
    return request(dataDir, method, scoped, signal) as ReturnType<
      ClientMethods[M]
    >;
  };
}

async function request(
  dataDir: string,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
): Promise<unknown> {
  let descriptor: Endpoint;
  try {
    descriptor = JSON.parse(
      await readFile(join(resolve(dataDir), "service.json"), "utf8"),
    ) as Endpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new IntloomError(
        "PROTOCOL_UNSUPPORTED",
        "Cannot read the local service descriptor. Check its format and permissions.",
      );
    throw new IntloomError(
      "SERVICE_NOT_RUNNING",
      "Start intloom startup first.",
    );
  }
  if (
    descriptor.formatVersion !== 1 ||
    typeof descriptor.endpoint !== "string" ||
    typeof descriptor.token !== "string"
  )
    throw new IntloomError(
      "PROTOCOL_UNSUPPORTED",
      "Invalid or incompatible service descriptor.",
    );
  // JSON arrays turn undefined into null; omitted optional arguments must stay omitted.
  params = [...params];
  while (params.length && params.at(-1) === undefined) params.pop();
  const id = randomUUID();
  const message = `${JSON.stringify({ formatVersion: 1, token: descriptor.token, id, method, params })}\n`;
  if (Buffer.byteLength(message) > maximumBytes)
    throw new IntloomError("RESULT_TOO_LARGE", "Request exceeds 8 MiB.");
  return new Promise((resolve, reject) => {
    const socket = createConnection(descriptor.endpoint);
    let sent = false;
    let settled = false;
    let buffer = Buffer.alloc(0);
    const stop = (error?: unknown, data?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      if (error) reject(error);
      else resolve(data);
    };
    const abort = () =>
      stop(new IntloomError("OBSERVATION_CLOSED", "Stopped watching."));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    socket.setTimeout(method === "serviceShutdown" ? 0 : 30_000, () =>
      stop(
        new IntloomError(
          "SERVICE_BUSY",
          "Service response timed out; the operation may have been accepted. Query before retrying.",
        ),
      ),
    );
    socket.on("connect", () => {
      sent = true;
      socket.write(message);
    });
    socket.on("error", (error: NodeJS.ErrnoException) =>
      stop(
        new IntloomError(
          sent
            ? "SERVICE_CONNECTION_LOST"
            : error.code === "EACCES" || error.code === "EPERM"
              ? "SERVICE_ACCESS_DENIED"
              : "SERVICE_NOT_RUNNING",
          sent
            ? "Service connection lost; query the operation before retrying."
            : error.code === "EACCES" || error.code === "EPERM"
              ? "Local service access was denied."
              : "Start intloom startup first.",
        ),
      ),
    );
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > maximumBytes) {
        stop(
          new IntloomError("RESULT_TOO_LARGE", "Service result exceeds 8 MiB."),
        );
        return;
      }
      const end = buffer.indexOf(10);
      if (end < 0) return;
      try {
        const result = JSON.parse(
          buffer.subarray(0, end).toString("utf8"),
        ) as Reply;
        if (result.id !== id)
          throw new IntloomError(
            "PROTOCOL_UNSUPPORTED",
            "Service response ID did not match.",
          );
        if (!result.ok)
          stop(
            new IntloomError(
              result.error?.code ?? "EXECUTION_FAILED",
              result.error?.message ?? "Service operation failed.",
              result.error?.details,
            ),
          );
        else stop(undefined, result.data);
      } catch (error) {
        stop(error);
      }
    });
    socket.on("close", () => {
      if (!settled)
        stop(
          new IntloomError(
            "SERVICE_CONNECTION_LOST",
            "Service closed before responding; query before retrying.",
          ),
        );
    });
  });
}
