import { Mastra } from "@mastra/core/mastra";
import {
  MastraCompositeStore,
  type StorageDomains,
} from "@mastra/core/storage";
import { LibSQLStore } from "@mastra/libsql";
import {
  IntloomError,
  type ExecutionOrigin,
  type StepDataContext,
  type WorkflowDefinition,
  type Suspended,
} from "@intloom/loom-sdk";
import { copyJson } from "@intloom/loom-sdk/json";
import type {
  AcceptedResume,
  ExecutionBoundary,
  RunServices,
} from "../lifecycle/run-contracts.ts";
import { inspectCheckpoint } from "./checkpoints.ts";
import { buildWorkflow } from "./workflow.ts";
import type { Observation } from "../execution/observation.ts";
import type { ExecutableComponent, InlineStep } from "../execution/types.ts";
export interface WorkflowServices {
  readonly observation: Observation;
  readonly runId: string;
  readonly signal: AbortSignal;
  resolveCommand(
    packageName: string,
    command: string,
  ): Promise<import("@intloom/loom-sdk").InstalledLoomRef>;
  execute(
    component: ExecutableComponent,
    input: unknown,
    origin: ExecutionOrigin,
  ): Promise<unknown>;
  readonly kernel: Pick<RunServices, "child" | "id" | "now">;
  inline(
    step: InlineStep,
    data: StepDataContext<unknown> & {
      resumeData?: unknown;
      suspendData?: unknown;
      suspend(payload: unknown): Promise<Suspended>;
    },
    origin: ExecutionOrigin,
  ): Promise<unknown>;
  evaluate<T>(callback: () => Promise<T>, origin: ExecutionOrigin): Promise<T>;
}

export async function openMastraRuntime(storageUrl: string) {
  const storage = new LibSQLStore({ id: "intloom", url: storageUrl });
  let store: NonNullable<StorageDomains["workflows"]>;
  try {
    await storage.init();
    const workflows = await storage.getStore("workflows");
    if (!workflows?.supportsConcurrentUpdates())
      throw new IntloomError(
        "STORAGE_INCOMPATIBLE",
        "The execution store must atomically claim resumes.",
      );
    store = workflows;
  } catch (error) {
    await storage.close();
    throw error;
  }
  // Mastra.shutdown closes its store. Per-Run assemblies borrow the host's store instead of owning its handles.
  class BorrowedStorage extends MastraCompositeStore {
    override getStore<K extends keyof StorageDomains>(name: K) {
      return storage.getStore(name);
    }
    override async init() {}
    override async close() {}
  }
  return {
    inspect: (workflowId: string, runId: string) =>
      inspectCheckpoint(store, workflowId, runId),
    init(services: WorkflowServices) {
      const mastra = new Mastra({
        storage: new BorrowedStorage({ id: services.runId }),
        logger: false,
      });
      const running = new Set<{ cancel(): Promise<void> }>();
      return {
        async workflow(
          definition: WorkflowDefinition,
          input: unknown,
          resume?: AcceptedResume,
        ): Promise<ExecutionBoundary> {
          const built = buildWorkflow(services, definition);
          mastra.addWorkflow(built);
          const run = await built.createRun({ runId: services.runId });
          running.add(run);
          try {
            if (services.signal.aborted)
              throw new IntloomError(
                "EXECUTION_CANCELLED",
                "Execution was stopped.",
              );
            const result = resume
              ? await run.resume({
                  label: resume.wait.view.waitId,
                  ...(resume.data === undefined
                    ? {}
                    : { resumeData: resume.data }),
                })
              : await run.start({ inputData: input });
            if (result.status === "success")
              return {
                kind: "completed",
                output: copyJson(result.result, "output"),
              };
            if (result.status === "suspended") {
              const evidence = await inspectCheckpoint(
                store,
                definition.id,
                services.runId,
              );
              if (evidence.kind === "waiting") {
                services.observation.suspend();
                return evidence;
              }
              throw new IntloomError(
                "CHECKPOINT_UNAVAILABLE",
                "The wait snapshot could not be verified.",
              );
            }
            throw new IntloomError(
              "EXECUTION_FAILED",
              "Workflow execution did not complete successfully.",
            );
          } finally {
            running.delete(run);
          }
        },
        async cancel() {
          await Promise.all([...running].map((run) => run.cancel()));
        },
        // The per-Run instance owns registrations; host storage is closed only by its owner.
        async release() {
          await mastra.shutdown();
        },
      };
    },
    close: () => storage.close(),
  };
}
