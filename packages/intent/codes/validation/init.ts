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
import { targets } from "../../src/validation/review.ts";
const init = (async (_input, access) => {
  const state = validationStateSchema.parse(access.state.value);
  if (state.scope) return { outcome: "complete" };
  state.specification = (
    await outputOf(access, "specification", state.id)
  ).artifact;
  state.solution = (await outputOf(access, "solution", state.id)).artifact;
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
  state.scope = {
    specification: targets(state.specification.data),
    solution: targets(state.solution.data),
  };
  const prior = await access.storage.getArtifact("intent", "validation");
  state.baseline = prior ? basis(prior) : null;
  await access.state.update(json(state));
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default init;
