import type { JsonValue } from "@intloom/loom-sdk";
import { type PackageSource, readPackageArchive } from "./source.ts";

export async function inspectLoomPackage(source: string) {
  const bundle = await readPackageArchive(source);
  function describe({ ref, manifest, files, npmName }: PackageSource) {
    const possibleInteractions = [];
    for (const [workflow, component] of Object.entries(manifest.components)) {
      for (const node of component.structure ?? []) {
        if (!node || typeof node !== "object" || Array.isArray(node)) continue;
        const steps: JsonValue[] = Array.isArray(node.steps)
          ? node.steps
          : node.step
            ? [node.step]
            : [];
        for (const step of steps) {
          if (!step || typeof step !== "object" || Array.isArray(step))
            continue;
          const policy = step.interaction;
          if (
            typeof step.id === "string" &&
            policy &&
            typeof policy === "object" &&
            !Array.isArray(policy)
          )
            possibleInteractions.push({
              workflow,
              step: step.id,
              responsePolicy: policy.responsePolicy,
            });
        }
      }
    }
    return {
      ...ref,
      name: manifest.name,
      npmName,
      storage: manifest.storage,
      description: manifest.description,
      entry: manifest.entry,
      input: manifest.contracts.input,
      output: manifest.contracts.output,
      outcome: manifest.outcome,
      requirements: manifest.requirements,
      possibleInteractions,
      dependencies: manifest.dependencies,
      files: [...files.keys()].sort(),
    };
  }
  const [root, ...children] = bundle.packages;
  return { root: describe(root), dependencies: children.map(describe) };
}
