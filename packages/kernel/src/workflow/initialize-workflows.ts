import { getLogger } from "@intloom/utils";
import { join } from "node:path";
import { discoverWorkflows } from "./discover-workflows.ts";
import { workflowError } from "./errors.ts";
import { loadWorkflow } from "./load-workflow.ts";
import { registerWorkflows } from "./register-workflows.ts";
import type {
  LoadedAgent,
  InitializeWorkflowsOptions,
  WorkflowInitializationResult,
  WorkflowInitializationPhase,
  WorkflowInitializationOutcome,
} from "./types.ts";

/** Initializes each declared Workflow independently, retaining per-package diagnostics. */
export async function initializeWorkflows(
  options: InitializeWorkflowsOptions,
): Promise<WorkflowInitializationResult> {
  const log = getLogger();
  log.debug("workflow_discovery_started");
  const discovery = await discoverWorkflows(
    join(options.projectRoot, ".intloom/workflows"),
    options.config.workflows ?? [],
  );
  const results: WorkflowInitializationOutcome[] = [...discovery.failures];
  for (const failure of discovery.failures)
    log.error("workflow_load_failed", {
      packageName: failure.packageName,
      phase: failure.phase,
      err: failure.error,
    });
  let registries = registerWorkflows([], []);

  for (const source of discovery.sources) {
    let phase: WorkflowInitializationPhase = "load";
    let flowName: string | undefined;
    try {
      log.debug("workflow_load_started", { packageName: source.packageName });
      const workflow = await loadWorkflow(source);
      flowName = workflow.blueprint.flowName;

      // Registration publishes only a fully validated package; no model or credential is loaded here.
      phase = "agent";
      const agents: LoadedAgent[] = [];
      for (const [agentId, spec] of Object.entries(workflow.agentSpecs)) {
        agents.push(Object.freeze({ agentId, spec, source }));
      }

      phase = "register";
      // Registration validates completeness and conflicts before returning new registries; conflicts preserve previously registered packages.
      registries = registerWorkflows([workflow], agents, registries);
      results.push({
        packageName: source.packageName,
        flowName,
        isAvailable: true,
      });
      log.info("workflow_ready", {
        packageName: source.packageName,
        flowName,
        agentCount: agents.length,
      });
    } catch (cause) {
      const code =
        phase === "agent"
          ? "WORKFLOW_AGENT_FAILED"
          : phase === "register"
            ? "WORKFLOW_REGISTRATION_FAILED"
            : "WORKFLOW_LOAD_FAILED";
      log.error("workflow_load_failed", {
        packageName: source.packageName,
        phase,
        err: workflowError(cause, code, "Workflow initialization failed."),
      });
      results.push({
        packageName: source.packageName,
        ...(flowName === undefined ? {} : { flowName }),
        isAvailable: false,
        phase,
        error: workflowError(
          cause,
          code,
          `Cannot initialize Workflow ${source.packageName} during ${phase}`,
        ),
      });
    }
  }
  return { registries, workflows: results };
}
