import { openSync, writeSync, fsyncSync, closeSync, chmodSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import pino from "pino";
import { LoomError } from "../error/loom-error.ts";
import { formatIdTimestamp } from "../id/timestamp.ts";
import { retainLogs } from "./retention.ts";
import {
  sanitizeLogFields,
  serializeLogError,
  privateLogKey,
} from "./sanitize.ts";
import {
  logLevels,
  type Logger,
  type LogContext,
  type LogFields,
  type LogHandle,
  type LogLevel,
  type OpenLogOptions,
} from "./types.ts";

const reserved = new Set([
  "time",
  "level",
  "event",
  "runId",
  "stageName",
  "stepName",
  "executionId",
  "requestId",
]);
const contextKeys = [
  "runId",
  "stageName",
  "stepName",
  "executionId",
  "requestId",
] as const;

export async function openLog(options: OpenLogOptions): Promise<LogHandle> {
  for (const path of options.pino?.redact ?? []) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*/u.test(path) ||
      reserved.has(path.split(/[.[]/u)[0] ?? "")
    )
      throw new TypeError("Redaction cannot replace log identity fields.");
  }
  const directory = resolve(options.directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let remainingBytes = await retainLogs(directory);
  if (!remainingBytes)
    throw new LoomError(
      "LOG_CAPACITY_EXCEEDED",
      "Log capacity is exhausted by retained execution logs.",
    );
  let filePath: string;
  let fd: number;
  for (;;) {
    filePath = join(directory, `LOG-${formatIdTimestamp()}.jsonl`);
    try {
      fd = openSync(filePath, "wx", 0o600);
      break;
    } catch (cause) {
      if (
        !(cause instanceof Error) ||
        !("code" in cause) ||
        cause.code !== "EEXIST"
      )
        throw cause;
      await setTimeout(1);
    }
  }
  let closed = false;
  let failure: Error | undefined;
  let closing: Promise<void> | undefined;
  function failed(cause: unknown, notifyOnly = false) {
    if (failure) return;
    failure = new LoomError(
      "LOG_WRITE_FAILED",
      "Cannot persist the execution log.",
      { cause },
    );
    if (options.onError) options.onError(failure);
    else if (!notifyOnly) throw failure;
  }
  function assertHealthy() {
    if (failure) throw failure;
    if (closed)
      throw new LoomError("LOG_CLOSED", "The execution log is closed.");
  }
  function flush() {
    assertHealthy();
    try {
      fsyncSync(fd);
    } catch (cause) {
      failed(cause, true);
      throw failure;
    }
  }
  let engine: pino.Logger;
  try {
    engine = pino(
      {
        level: "debug",
        base: null,
        messageKey: "event",
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: [...(options.pino?.redact ?? [])],
      },
      {
        write(line) {
          if (closed || failure) return;
          try {
            const buffer = Buffer.from(line);
            if (buffer.length > remainingBytes)
              throw new Error("Execution log capacity exceeded.");
            let offset = 0;
            while (offset < buffer.length) {
              const written = writeSync(
                fd,
                buffer,
                offset,
                buffer.length - offset,
              );
              if (!written) throw new Error("Log write made no progress.");
              offset += written;
              remainingBytes -= written;
            }
          } catch (cause) {
            failed(cause);
          }
        },
      },
    );
  } catch (cause) {
    closeSync(fd);
    throw cause;
  }

  function create(context: LogContext): Logger {
    const bindings = Object.freeze(sanitizeLogFields(context as LogFields));
    function write(level: LogLevel, event: string, fields: LogFields = {}) {
      if (closed || failure) return;
      if (!/^[a-z][a-z0-9_]{0,79}$/u.test(event))
        throw new TypeError("Log events must use lowercase_snake_case.");
      const projected: Record<string, unknown> = Object.create(null);
      try {
        for (const [key, descriptor] of Object.entries(
          Object.getOwnPropertyDescriptors(fields),
        )) {
          if (
            !descriptor.enumerable ||
            !("value" in descriptor) ||
            privateLogKey(key)
          )
            continue;
          if (
            reserved.has(key) &&
            (key in bindings ||
              !contextKeys.includes(key as (typeof contextKeys)[number]))
          )
            continue;
          const serializer = Object.hasOwn(options.pino?.serializers ?? {}, key)
            ? options.pino?.serializers?.[key]
            : undefined;
          projected[key] =
            key === "err"
              ? serializeLogError(descriptor.value)
              : serializer
                ? serializer(descriptor.value)
                : descriptor.value;
        }
        engine[level]({ ...sanitizeLogFields(projected), ...bindings }, event);
      } catch (cause) {
        if (failure) throw cause;
        engine[level]({ ...bindings, truncated: true }, event);
      }
    }
    return Object.freeze({
      assertHealthy,
      child(next: LogContext) {
        const merged: Record<string, unknown> = { ...bindings };
        for (const key of contextKeys)
          if (next[key] !== undefined && !(key in bindings))
            merged[key] = next[key];
        return create(merged as LogContext);
      },
      debug: (event, fields) => write("debug", event, fields),
      info: (event, fields) => write("info", event, fields),
      warn: (event, fields) => write("warn", event, fields),
      error: (event, fields) => write("error", event, fields),
      fatal: (event, fields) => write("fatal", event, fields),
      isLevelEnabled: (level) => !closed && !failure && logLevels[level] >= 20,
    } satisfies Logger);
  }
  const logger = create({});
  try {
    logger.debug("log_opened", { schemaVersion: 1, pid: process.pid });
  } catch (cause) {
    closeSync(fd);
    throw cause;
  }
  return Object.freeze({
    logger,
    filePath,
    flush,
    close() {
      closing ??= (async () => {
        try {
          assertHealthy();
          logger.debug("log_closed");
          flush();
        } catch (cause) {
          failed(cause, true);
        } finally {
          closed = true;
          try {
            closeSync(fd);
          } catch (cause) {
            failed(cause, true);
          }
        }
        if (failure) throw failure;
        // Seal only after sync AND close succeeded; a tail marker alone is not proof.
        try {
          chmodSync(filePath, 0o400);
        } catch (cause) {
          failed(cause, true);
          throw failure;
        }
      })();
      return closing;
    },
  });
}
