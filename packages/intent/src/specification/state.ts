import type {
  CodeExecutionAccess,
  JsonValue,
  StorageReadAccess,
} from "@intloom/workflow-sdk";
import * as z from "zod";
import {
  specificationStateSchema,
  type SpecificationState,
} from "../../schemas/specification-state.ts";
import { fail } from "./errors.ts";

export type SpecificationAccess = Pick<
  CodeExecutionAccess<JsonValue>,
  "state"
> & {
  readonly storage: StorageReadAccess;
};
export function readState(access: SpecificationAccess): SpecificationState {
  const result = specificationStateSchema.safeParse(access.state.value);
  if (!result.success)
    fail(`Invalid Specification State: ${result.error.message}`);
  return result.data;
}
export function readInitializedState(
  access: SpecificationAccess,
): SpecificationState {
  const state = readState(access);
  if (state.baseline === undefined)
    fail("Init must load the Specification baseline first");
  return state;
}
export async function saveState(
  access: SpecificationAccess,
  state: SpecificationState,
): Promise<void> {
  // Strip optional undefined values before crossing Kernel's JSON boundary.
  const data: unknown = JSON.parse(
    JSON.stringify(specificationStateSchema.parse(state)),
  );
  await access.state.update(z.json().parse(data));
}
