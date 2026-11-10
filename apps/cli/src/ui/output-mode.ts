import { AsyncLocalStorage } from "node:async_hooks";

// Scope presentation to one command, including its asynchronous logs and nested calls.
const plain = new AsyncLocalStorage<boolean>();
export const isPlainOutput = () => plain.getStore() ?? false;
export const withPlainOutput = <T>(enabled: boolean, run: () => T): T =>
  plain.run(enabled, run);

// Service notifications and process signals can arrive outside the command's async context.
export function bindOutput<Args extends unknown[], Result>(
  run: (...args: Args) => Result,
) {
  const enabled = isPlainOutput();
  return (...args: Args): Result =>
    withPlainOutput(enabled, () => run(...args));
}
