import {
  solutionStateSchema,
  type SolutionState,
} from "../../schemas/solution-state.ts";
import { json, fail, sameBasis, type ReadAccess } from "../flow/shared.ts";
export function readSolution(access: ReadAccess) {
  const state = solutionStateSchema.parse(access.state.value);
  if (!state.specification || state.baseline === undefined)
    fail("Solution must be initialized.");
  return state;
}
export async function saveSolution(access: ReadAccess, state: SolutionState) {
  await access.state.update(json(solutionStateSchema.parse(state)));
}
export async function assertSolutionBasis(
  access: ReadAccess,
  state: SolutionState,
) {
  if (!state.specification) fail("Missing specification basis.");
  await sameBasis(access, "specification", state.specification);
  const current = await access.storage.getArtifact("intent", "solution");
  if (
    state.baseline
      ? !current ||
        current.id !== state.baseline.id ||
        current.revision !== state.baseline.revision
      : current
  )
    fail("Solution baseline changed.", "STALE_INTENT_BASIS");
}
