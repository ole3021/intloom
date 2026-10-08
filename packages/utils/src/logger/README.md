# Logging

Structured JSONL file logging with asynchronous context and filtered reading. See the [Utils overview](../../README.md) for installation. Import functions and types from `@intloom/utils`.

One owner opens the log and closes it after its execution resources are released. Libraries receive a `Logger` or use the current asynchronous context.

## Usage

```ts
import { getLogger, openLog, withLogger } from "@intloom/utils";

const logs = await openLog({ directory: ".intloom/logs" });
try {
  const log = logs.logger.child({ runId: "RUN-example" });
  await withLogger(log, async () => {
    getLogger().info("operation_started");
    getLogger().debug("operation_completed", { count: 3, durationMs: 12 });
  });
} finally {
  await logs.close();
}
```

## API

| API | Responsibility |
| --- | --- |
| `openLog({ directory, pino?, onError? })` | Create an exclusive file; return `{ logger, filePath, flush, close }` |
| `logger.debug/info/warn/error/fatal(event, fields?)` | Write a lowercase_snake_case event with a small structured summary |
| `logger.child({ runId?, stageName?, stepName?, executionId?, requestId? })` | Bind immutable context; children cannot replace existing bindings |
| `logger.assertHealthy()` | Check immediately before a new side effect; throws after failure or close, no-op for `silentLogger` |
| `logger.isLevelEnabled(level)` | Check whether the file still accepts that level |
| `withLogger(logger, operation)` | Propagate context across asynchronous calls; preserve the callback return type |
| `getLogger()` | Read current context; return `silentLogger` outside a scope |
| `silentLogger` | Frozen no-op logger; accepts health checks and disables every level |
| `logLevels` | Frozen mapping from supported level names to Pino's numeric values |
| `readLog(filePath, { output, level?, runId?, requestId?, offset?, signal? })` | Read complete JSONL records and return the next byte offset |
| `followLog(filePath, options)` | Follow one file; cancellation drains a fixed file snapshot for up to 100 ms |
| `logs.flush()` | Synchronously fsync, report failure and throw; leaves the log open |
| `logs.close()` | Write a close marker, fsync, close and seal read-only; idempotent, rejects on failure |

Public types are `Logger`, `LogLevel`, `LogContext`, `LogFields`, `OpenLogOptions`, `LogHandle`, and `ReadLogOptions`; see [types.ts](./types.ts) for their signatures.

Levels are `debug = 20`, `info = 30`, `warn = 40`, `error = 50`, and `fatal = 60`. Files always include debug and above; readers default to info.

## Context

`child` adds `runId`, `stageName`, `stepName`, `executionId`, and `requestId` bindings. Existing bindings win over later child bindings and per-event fields. Per-event fields cannot replace `time`, `level`, or `event`.

`withLogger` preserves synchronous values and Promises returned by the callback. Concurrent asynchronous scopes keep independent contexts. Each loaded copy of Utils owns its own context; pass a `Logger` explicitly when execution crosses independently loaded copies.

## Reading

```ts
import { readLog } from "@intloom/utils";

const offset = await readLog(logs.filePath, {
  output: process.stdout,
  level: "debug",
  runId: "RUN-example",
});
```

`readLog` and `followLog` borrow the supplied `Writable` without ending or destroying it and await its write callbacks. They retain incomplete UTF-8/JSONL tails until complete and skip malformed complete JSON lines. Complete records and incomplete tails share a 64 KiB byte limit, excluding the newline; larger records reject with `Error`. Returned offsets count bytes through confirmed complete lines, including filtered records. Resume only from a returned offset or a known complete line boundary.

`requestId` filtering learns associated Run IDs while scanning a single invocation, including records below the chosen level. A new call starting at an offset does not restore associations found before that offset; supply the known `runId` when resuming, or keep one `followLog` invocation. When both filters are supplied, records must also match `runId`.

`followLog` polls at EOF every 75 ms. For either reader, cancellation snapshots the current file size and allows up to 100 ms to drain complete records within that boundary. Later appends do not extend the drain, and stalled output cannot hold the reader open indefinitely. The reader then closes its file and returns the last confirmed offset. A submitted write may finish after cancellation; its unconfirmed record can be replayed when resuming. Temporary output listeners remain only until that pending write finishes or the stream closes, so late output errors stay handled.

## Files and failures

The supplied directory remains flat: `LOG-20261008T063015123Z.jsonl`. Filenames use UTC through milliseconds; exclusive creation retries timestamp collisions. New files are mode 0600 and new directories 0700 where supported. Records contain `time`, `level`, `event`, and applicable context/fields. The writer adds `schemaVersion` and `pid` to `log_opened` only. No duplicate `msg`, hostname, or default per-line PID is emitted.

Writes are synchronous so I/O failures are observable without an unbounded queue. `flush` performs fsync; `close` writes `log_closed`, fsyncs, closes, and seals the file to mode 0400. Ordinary writes do not guarantee power-loss durability. A seal failure rejects close; a close marker alone does not certify successful closure.

Opening a log runs retention: closed logs older than 14 days are removed, then the oldest closed logs are removed when the directory reaches 1 GiB. Only matching ordinary files with a final `log_closed` record and a read-only seal qualify. Incomplete and unsealed logs remain for diagnosis and count against capacity. The active file never rotates. Capacity accounting assumes one owner per directory; the host supplies the ownership lock.

| Condition | Behavior |
| --- | --- |
| No capacity when opening | Reject with `LOG_CAPACITY_EXCEEDED` |
| Write, capacity, fsync, close, or seal failure after opening | Record `LOG_WRITE_FAILED`; subsequent health checks and `close` throw/reject |
| `onError` supplied | Notify the owner once; a failed write returns after notification |
| No `onError` | The first failed write throws |
| Write after failure or close | Ignore the write; `isLevelEnabled` returns `false` |
| Health check or flush after successful close | Throw `LOG_CLOSED` |

The owner must stop starting new effects after a logging failure and release active resources before closing. `onError` is a synchronous notification callback; `flush` and `close` still report failures. Already committed effects remain committed.

## Safe summaries and Pino customization

Pass small summaries: names, IDs, counts, durations, outcomes, and classified error codes. Keep intent, prompts, answers, State, request/response bodies, environment, credentials, and complete configuration/SDK objects out of log fields. Built-in filtering recursively removes recognized sensitive keys and masks bearer tokens, common API-key text, and HTTP(S) URLs. Field traversal skips accessors and `toJSON` and bounds depth, fields, arrays, and strings. Arbitrary secrets under unrelated keys still require caller review.

```ts
import type { OpenLogOptions } from "@intloom/utils";

const options: OpenLogOptions = {
  directory: ".intloom/logs",
  pino: {
    serializers: { result: (value) => ({ count: value.items.length }) },
    redact: ["metadata.privateValue"],
  },
};
// Pass options to openLog and keep the same try/finally ownership as above.
```

Serializers project selected fields before built-in filtering. Additional Pino redaction paths cannot target identity fields. The reserved `err` serializer keeps machine codes, an optional HTTP status, retryability, bounded cause codes, and basename/line stack locations; it excludes raw messages, SDK payloads, and stack headings even if a custom `err` serializer is supplied. Formatting, destinations, timestamps, and file level are fixed. Reserve `log_opened` and `log_closed` for the log lifecycle.

## Terminal formatting

JSONL remains compatible with native pino-pretty; formatting happens when reading, never in the file writer:

```sh
pino-pretty --messageKey event --ignore pid,hostname,schemaVersion \
  < .intloom/logs/LOG-20261008T063015123Z.jsonl
```

Install `pino-pretty` in the consuming application; Utils does not require it at runtime. Programmatic consumers can pass a pino-pretty stream as `readLog`'s output and configure native options such as `colorize`, `messageFormat`, and `translateTime`.
