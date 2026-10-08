import { fstatSync } from "node:fs";
import { open } from "node:fs/promises";
import type { Writable } from "node:stream";
import {
  clearTimeout,
  setImmediate,
  setTimeout as schedule,
} from "node:timers";
import { setTimeout } from "node:timers/promises";
import { logLevels, type ReadLogOptions } from "./types.ts";

const maxRecordBytes = 64 * 1024;
const cancellationDrainMs = 100;

function writeRecord(
  output: Writable,
  line: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise<boolean>((resolveWrite, rejectWrite) => {
    const cancel = () => {
      signal.removeEventListener("abort", cancel);
      resolveWrite(false);
    };
    const cleanup = () => {
      signal.removeEventListener("abort", cancel);
      output.off("error", failed);
      output.off("close", cleanup);
    };
    const failed = (error: Error) => {
      cleanup();
      rejectWrite(error);
    };
    output.on("error", failed);
    output.once("close", cleanup);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      output.write(`${line}\n`, (error) => {
        signal.removeEventListener("abort", cancel);
        if (error) {
          // Writable emits error after the callback, including after cancellation.
          setImmediate(() => {
            cleanup();
            rejectWrite(error);
          });
        } else {
          cleanup();
          resolveWrite(true);
        }
      });
    } catch (cause) {
      cleanup();
      rejectWrite(cause);
    }
  });
}

/** Offsets are bytes; an incomplete final line is withheld until the next append. Output is borrowed. */
async function consume(
  filePath: string,
  options: ReadLogOptions,
  follow: boolean,
): Promise<number> {
  const file = await open(filePath, "r");
  let offset = options.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    await file.close();
    throw new TypeError("Invalid log offset.");
  }
  let pending: Buffer = Buffer.alloc(0);
  let completeOffset = offset;
  const runs = new Set(options.runId ? [options.runId] : []);
  const drain = new AbortController();
  let drainEnd: number | undefined;
  let drainError: unknown;
  let drainTimer: ReturnType<typeof schedule> | undefined;
  function cancel() {
    try {
      drainEnd = fstatSync(file.fd).size;
    } catch (cause) {
      drainError = cause;
      drain.abort();
    }
    // Preserve final diagnostics, but bound both backlog and blocked output waits.
    drainTimer = schedule(() => drain.abort(), cancellationDrainMs);
  }
  try {
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const buffer = Buffer.alloc(32 * 1024);
    for (;;) {
      if (drainError !== undefined) throw drainError;
      if (drain.signal.aborted) break;
      const length =
        drainEnd === undefined
          ? buffer.length
          : Math.min(buffer.length, Math.max(0, drainEnd - offset));
      if (!length) break;
      const read = await file.read(buffer, 0, length, offset);
      const bytesRead =
        drainEnd === undefined
          ? read.bytesRead
          : Math.min(read.bytesRead, Math.max(0, drainEnd - offset));
      if (!bytesRead) {
        if (!follow || drainEnd !== undefined) break;
        await setTimeout(75, undefined, { signal: options.signal }).catch(
          (cause: unknown) => {
            if (!options.signal?.aborted) throw cause;
          },
        );
        continue;
      }
      offset += bytesRead;
      pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
      let newline = pending.indexOf(10);
      while (newline >= 0) {
        if (drain.signal.aborted) return completeOffset;
        if (newline > maxRecordBytes)
          throw new Error("Log record exceeds the reader limit.");
        const line = pending.subarray(0, newline).toString("utf8");
        pending = pending.subarray(newline + 1);
        newline = pending.indexOf(10);
        const previousOffset = completeOffset;
        completeOffset = offset - pending.length;
        if (!line.trim()) continue;
        let record: Record<string, unknown>;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        if (!record || typeof record !== "object") continue;
        if (
          options.requestId &&
          record.requestId === options.requestId &&
          typeof record.runId === "string"
        )
          runs.add(record.runId);
        if (options.runId && record.runId !== options.runId) continue;
        if (
          options.requestId &&
          record.requestId !== options.requestId &&
          !runs.has(String(record.runId))
        )
          continue;
        if (
          typeof record.level !== "number" ||
          record.level < logLevels[options.level ?? "info"]
        )
          continue;
        if (!(await writeRecord(options.output, line, drain.signal)))
          return previousOffset;
      }
      if (pending.length > maxRecordBytes)
        throw new Error("Log record exceeds the reader limit.");
    }
    return completeOffset;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    if (drainTimer) clearTimeout(drainTimer);
    await file.close();
  }
}

export function readLog(
  filePath: string,
  options: ReadLogOptions,
): Promise<number> {
  return consume(filePath, options, false);
}
export function followLog(
  filePath: string,
  options: ReadLogOptions,
): Promise<number> {
  return consume(filePath, options, true);
}
