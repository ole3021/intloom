import { scaffoldProject } from "./initialize.ts";
import { doctorProject } from "./doctor.ts";
import { readProjectConfig, updateProjectConfig } from "./configuration.ts";
import {
  planMcpConfig,
  applyMcpConfig,
  type McpConfigInput,
} from "./mcp-config.ts";
import { diagnoseProject, recoverProject } from "@intloom/kernel/host";
import type { ProjectInput } from "../contracts.ts";
import { local } from "../local.ts";

export function createProjectOperations() {
  return {
    initProject: scaffoldProject,
    inspectProject(input: ProjectInput) {
      return local(input, (meta) => diagnoseProject(meta.projectRoot));
    },
    readProjectConfig(input: ProjectInput) {
      return local(input, (meta) => readProjectConfig(meta.projectRoot));
    },
    updateProjectConfig(
      input: ProjectInput & { configuration: string; revision: string },
    ) {
      return local(input, (meta) =>
        updateProjectConfig(
          meta.projectRoot,
          input.configuration,
          input.revision,
        ),
      );
    },
    doctor(
      input: ProjectInput & { execution?: "cli" | "studio" | "agent_ide" },
    ) {
      return local(input, (meta) =>
        doctorProject(meta.projectRoot, input.execution),
      );
    },
    recoverProject(input: ProjectInput & { dryRun?: boolean }) {
      return local(input, (meta) =>
        recoverProject(meta.projectRoot, input.dryRun ?? false),
      );
    },
    planMcpConfig(input: McpConfigInput) {
      return local(input, () => planMcpConfig(input));
    },
    applyMcpConfig(input: McpConfigInput & { beforeHash: string }) {
      return local(input, () => applyMcpConfig(input));
    },
  };
}
