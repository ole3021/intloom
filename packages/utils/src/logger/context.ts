import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "./types.ts";

const context = new AsyncLocalStorage<Logger>();
const noop = () => {};
export const silentLogger: Logger = Object.freeze({
  assertHealthy: noop,
  child: () => silentLogger,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  isLevelEnabled: () => false,
});

/** Returns only the current asynchronous call's logger; no process-global active Run. */
export function getLogger(): Logger {
  return context.getStore() ?? silentLogger;
}

export function withLogger<T>(logger: Logger, operation: () => T): T {
  return context.run(logger, operation);
}
