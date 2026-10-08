import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { storageError } from "./errors.ts";

/** Tracks accepted work independently of Runtime's logical stop. */
export function createLifecycle(close: () => void | Promise<void>) {
  const pending = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  let failed: Error | undefined;
  return {
    run<T>(operation: () => T | Promise<T>): Promise<T> {
      if (closing)
        return Promise.reject(
          KERNEL_ERRORS.create("KERNEL_UNAVAILABLE", {
            message: "Storage is closed.",
            retryable: false,
          }),
        );
      if (failed) return Promise.reject(failed);
      let result: Promise<T>;
      try {
        // Invoke immediately so validation copies caller input before any await.
        result = Promise.resolve(operation()).catch((error: unknown) => {
          throw storageError(error);
        });
      } catch (error) {
        result = Promise.reject(storageError(error));
      }
      pending.add(result);
      void result.then(
        () => pending.delete(result),
        () => pending.delete(result),
      );
      return result;
    },
    fail(error: unknown) {
      failed = storageError(error);
    },
    assertHealthy() {
      if (failed) throw failed;
    },
    dispose(): Promise<void> {
      closing ??= Promise.resolve()
        .then(async () => {
          await Promise.allSettled([...pending]);
          await close();
        })
        .catch((error: unknown) => {
          throw storageError(error);
        });
      return closing;
    },
  };
}
