import type { ReadonlyValue } from "./json.ts";

/** Accesses business State for the current Stage of the current Run. */
export interface StateAccess<State> {
  readonly value: ReadonlyValue<State> | undefined;

  /** Creates only when absent and saves the Schema-parsed result. */
  create(value: State): Promise<void>;
  /** Replaces an existing value as a whole without merging fields; validation failure preserves the original value. */
  update(value: State): Promise<void>;
  /** Clears idempotently without triggering automatic reinitialization. */
  clear(): Promise<void>;
}
