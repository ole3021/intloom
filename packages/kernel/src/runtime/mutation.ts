export type MutationResult<T> =
  | { readonly status: "applied"; readonly value: T }
  | { readonly status: "not_applied"; readonly error: unknown }
  | {
      readonly status: "indeterminate";
      readonly error: unknown;
      readonly runId?: string;
    };

export function mutate<T>(
  apply: (effect: (knownRunId?: string) => void) => T,
  runId?: string,
): MutationResult<T> {
  let changed = false;
  try {
    return {
      status: "applied",
      value: apply((knownRunId) => {
        changed = true;
        runId ??= knownRunId;
      }),
    };
  } catch (error) {
    return changed
      ? { status: "indeterminate", error, ...(runId ? { runId } : {}) }
      : { status: "not_applied", error };
  }
}
export async function mutateAsync<T>(
  apply: (effect: (knownRunId?: string) => void) => Promise<T>,
  runId?: string,
): Promise<MutationResult<T>> {
  let changed = false;
  try {
    return {
      status: "applied",
      value: await apply((knownRunId) => {
        changed = true;
        runId ??= knownRunId;
      }),
    };
  } catch (error) {
    return changed
      ? { status: "indeterminate", error, ...(runId ? { runId } : {}) }
      : { status: "not_applied", error };
  }
}
export function unwrapMutation<T>(result: MutationResult<T>): T {
  if (result.status === "applied") return result.value;
  throw result.error;
}
