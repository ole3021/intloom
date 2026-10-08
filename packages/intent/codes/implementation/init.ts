import type { ExecutableCode } from "@intloom/workflow-sdk";
import { implementationStateSchema } from "../../schemas/implementation-state.ts";
import { solutionRecordSchema } from "../../schemas/solution-state.ts";
import { outputOf, project, json } from "../../src/flow/shared.ts";
const init = (async (_input, access) => {
  const state = implementationStateSchema.parse(access.state.value);
  if (state.initialSnapshot) return { outcome: "complete" };
  state.specification = (
    await outputOf(access, "specification", state.id)
  ).artifact;
  const solution = await outputOf(access, "solution", state.id);
  state.solution = solution.artifact;
  state.checks = solutionRecordSchema.parse(solution.record.data).checks;
  state.initialSnapshot = { ...(await project(access).snapshot()) };
  await access.state.update(json(state));
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default init;
