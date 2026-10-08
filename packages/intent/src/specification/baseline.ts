import { isDeepStrictEqual } from "node:util";
import { specificationArtifactSchema } from "../../schemas/specification-artifact.ts";
import type { SpecificationState } from "../../schemas/specification-state.ts";
import { flowName, stageName } from "./constants.ts";
import { fail } from "./errors.ts";
import type { SpecificationAccess } from "./state.ts";

export async function loadBaseline(access: SpecificationAccess) {
  const stored = await access.storage.getArtifact(flowName, stageName);
  if (
    stored &&
    (stored.flowName !== flowName || stored.stageName !== stageName)
  )
    fail("Storage returned an Artifact for another Stage");
  return stored
    ? {
        artifactId: stored.id,
        revision: stored.revision,
        data: specificationArtifactSchema.parse(stored.data),
      }
    : null;
}
export async function assertBaseline(
  access: SpecificationAccess,
  state: SpecificationState,
) {
  if (!isDeepStrictEqual(await loadBaseline(access), state.baseline))
    fail(
      "Formal Artifact changed; re-run Check and obtain a new confirmation",
      "STALE_SPECIFICATION_BASELINE",
    );
}
