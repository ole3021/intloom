import { restoreMirror } from "@intloom/kernel/host";
import {
  listMirrors,
  inspectMirror,
  exportMirrors,
  type RestoreMirrorInput,
} from "@intloom/kernel/operations";
import type { ProjectInput } from "./contracts.ts";
import { local } from "./local.ts";

export function createMirrorsOperations() {
  return {
    listMirrors(input: ProjectInput) {
      return local(input, (meta) => listMirrors(meta.projectRoot));
    },
    inspectMirror(input: ProjectInput & { mirrorId: string }) {
      return local(input, (meta) =>
        inspectMirror(meta.projectRoot, input.mirrorId),
      );
    },
    restoreMirror(
      input: ProjectInput & Omit<RestoreMirrorInput, "sourceProject">,
    ) {
      return local(input, (meta) =>
        restoreMirror({
          sourceProject: meta.projectRoot,
          mirrorId: input.mirrorId,
          targetProject: input.targetProject,
          scope: input.scope,
          ...(input.dryRun === undefined ? {} : { dryRun: input.dryRun }),
        }),
      );
    },
    exportMirrors(
      input: ProjectInput & { traceId: string; targetProject: string },
    ) {
      return local(input, (meta) =>
        exportMirrors(meta.projectRoot, input.traceId, input.targetProject),
      );
    },
  };
}
