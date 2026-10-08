import type { ExecutableCode } from "@intloom/workflow-sdk";
import { solutionStateSchema } from "../../schemas/solution-state.ts";
import { basis, json, outputOf } from "../../src/flow/shared.ts";
const init = (async (_input, access) => {
  const state = solutionStateSchema.parse(access.state.value);
  if (state.specification) return { outcome: "complete" };
  const upstream = await outputOf(access, "specification", state.id);
  state.specification = upstream.artifact;
  const old = await access.storage.getArtifact("intent", "solution");
  state.baseline = old ? basis(old) : null;
  await access.state.update(json(state));
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default init;
