import type { CompiledLoom } from "@intloom/loom-sdk";
import type { Inspection } from "../code/inspect.ts";
import type { Project } from "../project/read.ts";
import type { ResolvedReference } from "../project/resolve.ts";

export function createManifest(
  project: Project,
  entry: ResolvedReference,
  agent: ResolvedReference | undefined,
  kind: NonNullable<Inspection["entryKind"]>,
  skills: CompiledLoom["skills"],
  resources: string[],
): CompiledLoom {
  const { entry: _entry, agent: _agent, ...declaration } = project.manifest;
  return {
    ...declaration,
    resources,
    package: { name: project.package.name, version: project.package.version },
    entry: { module: entry.module, export: entry.export, kind },
    ...(agent
      ? {
          agent: {
            module: agent.module,
            export: agent.export,
            kind: "agent" as const,
          },
        }
      : {}),
    skills,
  };
}

export function createPackage(project: Project, manifest: CompiledLoom) {
  return {
    ...project.package,
    loom: "./loom.json",
    exports: {
      ".": {
        types: manifest.entry.module
          .replace(/\.mjs$/, ".d.mts")
          .replace(/\.js$/, ".d.ts"),
        import: manifest.entry.module,
      },
      "./loom.json": "./loom.json",
      "./*": "./*",
    },
  };
}
