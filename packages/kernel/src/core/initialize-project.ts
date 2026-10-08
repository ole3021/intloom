import { createProjectAccess } from "../project/access.ts";
import { createExecutionPreparation } from "./prepare-execution.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { getLogger, withLogger } from "@intloom/utils";
import { createRuntime } from "../runtime/create-runtime.ts";
import { checkProject } from "./check-project.ts";
import { openRunCheckpointStore } from "../runtime/recovery/store.ts";
import { workflowIdentity } from "../runtime/recovery/workflow-identity.ts";
import { initializeWorkflows } from "../workflow/initialize-workflows.ts";
import type {
  InitializeProjectOptions,
  ProjectExecution,
} from "./contracts.ts";

/** Creates an independent Runtime each time; the host retains the result and routes later answers to the same environment. */
export async function initializeProject(
  projectRoot: string,
  options: InitializeProjectOptions,
): Promise<ProjectExecution> {
  const project = await checkProject(projectRoot);
  const logger = options.logger ?? getLogger();
  const initialization = await withLogger(logger, () =>
    initializeWorkflows({
      projectRoot: project.projectRoot,
      config: project.config,
    }),
  ).catch((cause: unknown) => {
    throw KERNEL_ERRORS.wrap("KERNEL_UNAVAILABLE", cause, {
      message: "Cannot initialize Workflows from the project dependencies.",
    });
  });

  // Resource registries remain stable after initialization; SDK Agents and Schemas remain mutable, and in-place hot reload is unsupported.
  const registries = Object.freeze(initialization.registries);
  Object.freeze(registries.blueprints);
  Object.freeze(registries.codes);
  Object.freeze(registries.agents);
  Object.freeze(registries.sources);
  const preparation = createExecutionPreparation(
    project.config,
    registries.agents,
  );
  const runtime = createRuntime({
    project: createProjectAccess(project.projectRoot),
    ...(options.runtimeDirectory
      ? {
          recovery: {
            store: openRunCheckpointStore(options.runtimeDirectory),
            blueprints: registries.blueprints,
            workflowIdentities: Object.fromEntries(
              await Promise.all(
                Object.entries(registries.sources).map(
                  async ([name, source]) => [
                    name,
                    await workflowIdentity(source),
                  ],
                ),
              ),
            ),
          },
        }
      : {}),
    logger,
    ...(options.signal ? { signal: options.signal } : {}),
    codes: registries.codes,
    agents: preparation.agents,
    agentResources: registries.agents,
    prepareExecution: preparation.prepare,
    effector: options.effector,
    storage: options.storage,
  });
  await runtime.restore();
  return Object.freeze({
    projectRoot: project.projectRoot,
    executionReadiness: preparation.readiness,
    executionStatus: preparation.status,
    registries,
    runtime,
    workflows: Object.freeze(initialization.workflows),
  });
}
