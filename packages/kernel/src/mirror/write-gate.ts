import type { StorageAccess } from "../storage/contracts.ts";
import type { ProjectAccess } from "@intloom/loom-sdk";
import { KERNEL_ERRORS } from "../errors/kernel.ts";

/** Host writes already accepted before capture settle; new writes and Runs are rejected until release. */
export function createWriteGate() {
  const pending = new Set<Promise<unknown>>();
  let locked = false;
  function assertOpen(): void {
    if (locked)
      throw KERNEL_ERRORS.create("BUSY", {
        message: "Project writes are locked for mirror capture.",
      });
  }
  function run<T>(action: () => Promise<T>): Promise<T> {
    assertOpen();
    const task = Promise.resolve().then(action);
    pending.add(task);
    void task.then(
      () => pending.delete(task),
      () => pending.delete(task),
    );
    return task;
  }
  return {
    assertOpen,
    storage(access: StorageAccess): StorageAccess {
      return Object.freeze<StorageAccess>({
        ...access,
        commit: (input) => {
          const copied = structuredClone(input);
          return run(() => access.commit(copied));
        },
      });
    },
    project(access: ProjectAccess): ProjectAccess {
      return Object.freeze<ProjectAccess>({
        ...access,
        write: (path, text) => run(() => access.write(path, text)),
        remove: (path) => run(() => access.remove(path)),
        run: (command, signal) => {
          const copied = structuredClone(command);
          return run(() => access.run(copied, signal));
        },
      });
    },
    async capture<T>(action: () => Promise<T>): Promise<T> {
      assertOpen();
      locked = true;
      try {
        while (pending.size) await Promise.allSettled([...pending]);
        return await action();
      } finally {
        locked = false;
      }
    },
  };
}
