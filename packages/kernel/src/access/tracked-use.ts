import type { CallScope, CapabilityKind, CapabilityUse } from "./contracts.ts";

export function trackedUse<T>(
  scope: CallScope,
  kind: CapabilityKind,
  operation: (use: CapabilityUse) => Promise<T>,
): Promise<T> {
  // Admission precedes every asynchronous boundary and the operation itself.
  let use: CapabilityUse;
  try {
    use = scope.beginUse(kind);
  } catch (cause) {
    const failed = Promise.reject<T>(cause);
    void failed.catch(() => {});
    return failed;
  }
  const result = (async () => {
    try {
      const value = await operation(use);
      use.assertCurrent();
      return value;
    } finally {
      use.finish();
    }
  })();
  // Unawaited SDK uses still participate in Call settlement and must not become process-level rejections.
  void result.catch(() => {});
  return result;
}

export function readUse<T>(
  scope: CallScope,
  kind: CapabilityKind,
  read: () => T,
): T {
  const use = scope.beginUse(kind);
  try {
    const value = read();
    use.assertCurrent();
    return value;
  } finally {
    use.finish();
  }
}
