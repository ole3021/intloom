import { createMirrorCoordinator } from "../mirror/coordinator.ts";
import {
  protectedLoomPaths,
  safePath,
  exists,
  readBytes,
} from "../mirror/files.ts";
import { join, relative, sep } from "node:path";
import { createProjectAccess } from "../access/project/access.ts";
import { createExecutionPreparation } from "./prepare-execution.ts";
import { ERRORS } from "../errors.ts";
import { getLogger, withLogger } from "@intloom/utils";
import { createRuntime } from "../runtime/create-runtime.ts";
import { checkProject } from "./config/check-project.ts";
import { openRunCheckpointStore } from "./checkpoints/store.ts";
import { loomIdentity } from "../runtime/recovery/loom-identity.ts";
import { initializeLooms } from "../loom/initialize-looms.ts";
import type {
  InitializeProjectOptions,
  ProjectExecution,
} from "./project-contracts.ts";

/** Creates an independent Runtime each time; the host retains the result and routes later answers to the same environment. */
export async function initializeProject(
  projectRoot: string,
  options: InitializeProjectOptions,
): Promise<ProjectExecution> {
  const project = await checkProject(projectRoot);
  const logger = options.logger ?? getLogger();
  const initialization = await withLogger(logger, () =>
    initializeLooms({
      projectRoot: project.projectRoot,
      config: project.config,
    }),
  ).catch((cause: unknown) => {
    throw ERRORS.wrap("KERNEL_UNAVAILABLE", cause, {
      message: "Cannot initialize Looms from the project dependencies.",
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
    project.projectRoot,
  );
  const access = createProjectAccess(project.projectRoot);
  if (
    await exists(await safePath(project.projectRoot, ".intloom/restore.lock"))
  )
    throw ERRORS.create("KERNEL_UNAVAILABLE", {
      message:
        "Incomplete mirror restore detected; inspect .intloom/restore.lock and clean only this attempt's created paths before starting.",
    });
  const runtimeDirectory =
    options.runtimeDirectory ??
    (project.config.mirror?.enabled
      ? join(project.projectRoot, ".intloom/runtime")
      : undefined);
  const checkpointStore = runtimeDirectory
    ? openRunCheckpointStore(runtimeDirectory)
    : undefined;
  const persisted = checkpointStore?.read() ?? [];
  const mirrorEnabled =
    project.config.mirror?.enabled ||
    persisted.some((saved) => !!saved.control && saved.phase !== "terminal");
  const mirror = mirrorEnabled ? options.storageHandle : undefined;
  if (mirrorEnabled && !mirror)
    throw ERRORS.create("KERNEL_UNAVAILABLE", {
      message: "Mirror capture requires the host-owned StorageHandle.",
    });
  const coordinator = mirror
    ? createMirrorCoordinator(project.projectRoot, mirror, {
        include: project.config.mirror?.files?.include ?? [],
        exclude: project.config.mirror?.files?.exclude ?? [],
        protectedPaths: await protectedLoomPaths(
          project.projectRoot,
          registries.sources,
        ),
        ...(mirror.location
          ? {
              storagePath: relative(project.projectRoot, mirror.location)
                .split(sep)
                .join("/"),
            }
          : {}),
      })
    : undefined;
  const identities = checkpointStore
    ? Object.fromEntries(
        await Promise.all(
          Object.entries(registries.sources).map(async ([name, source]) => [
            name,
            await loomIdentity(source),
          ]),
        ),
      )
    : {};
  if (checkpointStore)
    for (const saved of persisted) {
      const commitId = saved.control?.restoreCommitId;
      if (!commitId) continue;
      const marker = JSON.parse(
        (
          await readBytes(
            project.projectRoot,
            `.intloom/restores/${commitId}.json`,
          )
        ).toString("utf8"),
      );
      if (
        !marker.complete ||
        marker.commitId !== commitId ||
        marker.runId !== saved.run.id ||
        marker.traceId !== saved.control?.traceId ||
        marker.sourceMirrorId !== saved.control?.sourceMirrorId
      )
        throw new Error(
          "Mirror restore completion marker is missing or inconsistent.",
        );
    }
  const runtime = createRuntime({
    ...(project.config.context ? { context: project.config.context } : {}),
    prepareAgent: preparation.prepareAgent,
    ...(coordinator ? { mirror: coordinator } : {}),
    project: coordinator ? coordinator.gate.project(access) : access,
    ...(runtimeDirectory
      ? {
          recovery: {
            store: checkpointStore as NonNullable<typeof checkpointStore>,
            blueprints: registries.blueprints,
            loomIdentities: identities,
          },
        }
      : {}),
    logger,
    ...(options.observation ? { observation: options.observation } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    codes: registries.codes,
    agents: preparation.agents,
    agentResources: registries.agents,
    async validateExecution(blueprint, saved) {
      const current = await preparation.prepare(blueprint, saved.source);
      if (JSON.stringify(current) !== JSON.stringify(saved))
        throw ERRORS.create("RECOVERY_INCOMPATIBLE");
    },
    executor: options.executor,
    storage: coordinator
      ? coordinator.gate.storage(options.storage)
      : options.storage,
  });
  await runtime.restore();
  return Object.freeze({
    projectRoot: project.projectRoot,
    executionReadiness: preparation.readiness,
    prepareExecution: preparation.prepare,
    executionStatus: preparation.status,
    registries,
    runtime,
    executor: options.executor,
    looms: Object.freeze(initialization.looms),
  });
}
