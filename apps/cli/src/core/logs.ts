import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Writable } from "node:stream";
import type { LogLevel } from "@intloom/utils";
import { projectRoot } from "@intloom/kernel/host";
import type { CoreResult, CoreMeta } from "@intloom/kernel/operations";
import { errorView } from "../errors.ts";
import { readProjectLogs } from "./log-reader.ts";
export interface LogInput {
  readonly projectPath: string;
  readonly runId?: string;
  readonly requestId?: string;
  readonly level?: LogLevel;
}
/** A borrowed observer with one-record backpressure; closing it never controls execution. */
export async function* watchLogs(
  input: LogInput,
  options: { signal?: AbortSignal; follow?: boolean } = {},
): AsyncIterable<CoreResult<Record<string, unknown>>> {
  const meta: CoreMeta = { requestId: randomUUID() };
  const abort = new AbortController();
  const cancel = () => abort.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  let notify: (() => void) | undefined;
  let pending:
    | { data: Record<string, unknown>; done: (error?: Error | null) => void }
    | undefined;
  let finished = false;
  let failed: unknown;
  let reading: Promise<void> | undefined;
  const output = new Writable({
    write(chunk, _encoding, done) {
      pending = { data: JSON.parse(String(chunk)), done };
      notify?.();
    },
  });
  try {
    meta.projectRoot = await projectRoot(input.projectPath);
    reading = readProjectLogs(join(meta.projectRoot, ".intloom", "logs"), {
      output,
      follow: options.follow ?? true,
      signal: abort.signal,
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.level ? { level: input.level } : {}),
    })
      .catch((error) => {
        failed = error;
      })
      .finally(() => {
        finished = true;
        notify?.();
      });
    for (;;) {
      if (pending) {
        const record = pending;
        pending = undefined;
        try {
          yield { ok: true, data: record.data, meta };
        } finally {
          record.done();
        }
        continue;
      }
      if (finished) break;
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
      notify = undefined;
    }
    if (failed)
      yield {
        ok: false,
        error: errorView(failed),
        outcome: "not_applied",
        meta,
      };
  } catch (error) {
    yield { ok: false, error: errorView(error), outcome: "not_applied", meta };
  } finally {
    abort.abort();
    pending?.done();
    await reading;
    output.destroy();
    options.signal?.removeEventListener("abort", cancel);
  }
}
export async function readLogs(
  input: LogInput,
): Promise<CoreResult<readonly Record<string, unknown>[]>> {
  const records: Record<string, unknown>[] = [];
  let meta: CoreMeta = { requestId: randomUUID() };
  for await (const result of watchLogs(input, { follow: false })) {
    meta = result.meta;
    if (!result.ok)
      return {
        ok: false,
        error: result.error,
        outcome: result.outcome,
        meta: result.meta,
      };
    records.push(result.data);
  }
  return { ok: true, data: records, meta };
}
