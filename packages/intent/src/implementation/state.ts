import {
  implementationStateSchema,
  type ImplementationState,
} from "../../schemas/implementation-state.ts";
import { fail, json, sameBasis, type ReadAccess } from "../flow/shared.ts";
export function readImplementation(access: ReadAccess) {
  const state = implementationStateSchema.parse(access.state.value);
  if (!state.specification || !state.solution || !state.initialSnapshot)
    fail("Implementation must be initialized.");
  return state;
}
export async function saveImplementation(
  access: ReadAccess,
  state: ImplementationState,
) {
  await access.state.update(json(implementationStateSchema.parse(state)));
}
export async function assertImplementationBasis(
  access: ReadAccess,
  state: ImplementationState,
) {
  if (!state.specification || !state.solution)
    fail("Missing implementation basis.");
  await sameBasis(access, "specification", state.specification);
  await sameBasis(access, "solution", state.solution);
}
