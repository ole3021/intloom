import type { Writable } from "node:stream";
import type { SerializerFn } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogFields = Readonly<Record<string, unknown>>;

export interface LogContext {
  readonly runId?: string;
  readonly stageName?: string;
  readonly stepName?: string;
  readonly executionId?: number;
  readonly requestId?: string;
}

export interface Logger {
  /** Throws after an I/O failure or close; silentLogger always permits execution. */
  assertHealthy(): void;
  child(context: LogContext): Logger;
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  fatal(event: string, fields?: LogFields): void;
  isLevelEnabled(level: LogLevel): boolean;
}

export interface OpenLogOptions {
  readonly directory: string;
  readonly pino?: {
    readonly serializers?: Readonly<Record<string, SerializerFn>>;
    /** Additional static redaction paths; built-in filtering remains enabled. */
    readonly redact?: readonly string[];
  };
  /** Called once after a write, sync, close, or seal failure. */
  readonly onError?: (error: Error) => void;
}

export interface LogHandle {
  readonly logger: Logger;
  readonly filePath: string;
  flush(): void;
  close(): Promise<void>;
}

export interface ReadLogOptions {
  readonly output: Writable;
  readonly level?: LogLevel;
  readonly runId?: string;
  readonly requestId?: string;
  readonly offset?: number;
  /** Drain the cancellation-time file snapshot for up to 100 ms; output remains caller-owned. */
  readonly signal?: AbortSignal;
}

export const logLevels: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
});
