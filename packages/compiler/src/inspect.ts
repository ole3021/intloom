import type { LoomManifest } from "@intloom/loom-sdk";
import { inspectDefinition } from "@intloom/loom-sdk/package-format";
import { inspectOutcome } from "./outcome.ts";
import { schemaType } from "./schema.ts";
export type { Inspection } from "@intloom/loom-sdk/package-format";
export function inspectForCompilation(
  value: unknown,
  target: LoomManifest["build"]["target"],
) {
  const result = inspectDefinition(value, target);
  for (const component of Object.values(result.manifest.components))
    if (component.contracts)
      for (const schema of Object.values(component.contracts))
        schemaType(schema);
  if (result.manifest.outcome)
    inspectOutcome(result.manifest.outcome, result.manifest.contracts.output);
  return result;
}
