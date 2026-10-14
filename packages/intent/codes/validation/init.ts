import type { ExecutableCode } from "@intloom/workflow-sdk";
import { validationStateSchema } from "../../schemas/validation-state.ts";
import { implementationRecordSchema } from "../../schemas/implementation-state.ts";
import {
  outputOf,
  recordId,
  basis,
  json,
  project,
  digest,
  fail,
} from "../../src/flow/shared.ts";
import { runChecks } from "../../src/implementation/checks.ts";
import { runScope } from "../../src/validation/scope.ts";
import { specificationRecordSchema } from "../../schemas/specification-record.ts";
import { solutionRecordSchema } from "../../schemas/solution-state.ts";
const init = (async (_input, access) => {
  const state = validationStateSchema.parse(access.state.value);
  if (state.scope) return { outcome: "complete" };
  const spec = await outputOf(access, "specification", state.id);
  const sol = await outputOf(access, "solution", state.id);
  state.specification = spec.artifact;
  state.solution = sol.artifact;
  state.implementationRecordId = recordId(state.id, "implementation");
  const stored = await access.storage.getRecordById(
    state.implementationRecordId,
  );
  if (stored?.stageName !== "implementation")
    fail("Missing current Implementation Record.");
  const implementation = implementationRecordSchema.parse(stored.data);
  if (
    implementation.id !== state.id ||
    digest(implementation.specification) !== digest(state.specification) ||
    digest(implementation.solution) !== digest(state.solution)
  )
    fail("Implementation used different requirements or design.");
  const files = project(access);
  if (digest(await files.snapshot()) !== implementation.resultDigest)
    fail("Code changed after Implementation completed.");
  const checked = await runChecks(
    files,
    implementation.checks.map((c) => ({
      id: c.id,
      purpose: c.purpose,
      ...c.command,
    })),
  );
  state.commandResults = checked.results;
  state.fileSnapshot = { ...checked.snapshot };
  const prior = await access.storage.getArtifact("intent", "validation");
  state.baseline = prior ? basis(prior) : null;
  Object.assign(
    state,
    runScope(
      state.specification.data,
      state.solution.data,
      [
        ...specificationRecordSchema.parse(spec.record.data).changes,
        ...solutionRecordSchema.parse(sol.record.data).changes,
      ],
      implementation,
      !prior,
    ),
  );
  await access.state.update(json(state));
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default init;
