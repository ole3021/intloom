import { loadConfig, type RunSource, type WorkflowView } from "@intloom/kernel";
import { errorView, failure } from "../errors.ts";
import { connectProjectClient } from "../client/mcp-client.ts";
import { discoverProjectConnection } from "../client/service-client.ts";
import { diagnoseProject, type ProjectDiagnosis } from "../service/recovery.ts";
import { listInstalledWorkflows } from "../workflows/manage.ts";
import { renderDiagnosis, renderWorkflows } from "../ui/render.ts";

export interface ProjectDoctorResult extends ProjectDiagnosis {
  readonly source: RunSource;
  readonly checks: readonly {
    readonly name: "configuration" | "installation" | "execution";
    readonly status: "ok" | "attention" | "not_checked";
    readonly message: string;
    readonly nextStep?: string;
  }[];
  readonly workflows?: readonly WorkflowView[];
}

/** Reads configuration/installations and queries an existing host; never imports Workflows, installs packages, or calls a model. */
export async function doctorProject(
  directory: string,
  source: RunSource = "cli",
): Promise<ProjectDoctorResult> {
  if (!["cli", "studio", "agent_ide"].includes(source))
    throw failure(
      "INVALID_REQUEST",
      "Execution entry must be cli, studio, or agent_ide.",
    );
  const diagnosis = await diagnoseProject(directory);
  const root = diagnosis.projectRoot;
  const checks: ProjectDoctorResult["checks"][number][] = [];
  try {
    const config = await loadConfig(root);
    checks.push({
      name: "configuration",
      status: "ok",
      message:
        "Project configuration is valid. A running host retains its startup configuration and environment.",
    });
    if (!diagnosis.service) {
      const service = source !== "agent_ide" || !config.useMcpAgent;
      checks.push({
        name: "execution",
        status: service && !config.llms ? "attention" : "not_checked",
        message:
          service && !config.llms
            ? "This entry requires llms.default before creating a Run."
            : service
              ? "Model configuration is present; required roles and credentials are checked by the host before Run creation. Remote model behavior is not verified."
              : "This entry selects the client Agent executor. The running host reports Workflow readiness; client task support requires separate acceptance.",
        nextStep:
          diagnosis.status !== "offline"
            ? "Resolve the service and lock diagnosis above before starting the project."
            : service && !config.llms
              ? "Configure llms.default and provide its referenced environment credential, then run intloom start."
              : `Run intloom start, then intloom doctor --execution ${source} to inspect loaded Workflows.`,
      });
    }
  } catch (cause) {
    checks.push({
      name: "configuration",
      status: "attention",
      message: errorView(cause).message,
      nextStep:
        "Correct the project configuration, then restart any running service.",
    });
  }
  try {
    const installed = await listInstalledWorkflows(root);
    const ready = installed.installation === "ready";
    checks.push({
      name: "installation",
      status: ready ? "ok" : "attention",
      message: ready
        ? `${installed.workflows.length} declared Workflow packages match the installed tree. Loading is checked separately by the host.`
        : installed.installation === "empty"
          ? "No Workflow packages are installed."
          : "The installed tree is missing, damaged, or differs from the declarations.",
      ...(!ready
        ? {
            nextStep: installed.workflows.length
              ? "Stop and start the service to restore declared packages. Keep local source archives accessible."
              : "Stop any running service, then run intloom workflow add <package-or-tgz>.",
          }
        : {}),
    });
  } catch (cause) {
    checks.push({
      name: "installation",
      status: "attention",
      message: errorView(cause).message,
    });
  }
  let workflows: readonly WorkflowView[] | undefined;
  if (diagnosis.service) {
    try {
      const connection = await discoverProjectConnection(
        root,
        source === "studio" ? "studio" : "cli",
      );
      const client = await connectProjectClient(
        source === "agent_ide"
          ? { ...connection, url: new URL("/mcp", connection.url).href }
          : connection,
      );
      try {
        workflows = await client.listWorkflows();
      } finally {
        await client.close();
      }
      const ready = workflows.filter(
        (item) => item.isAvailable && item.readiness?.status === "available",
      ).length;
      checks.push({
        name: "execution",
        status: ready ? "ok" : "attention",
        message: `${ready} of ${workflows.length} Workflows are ready for ${source}. This does not call or verify a remote model.`,
        ...(!ready
          ? {
              nextStep:
                "Resolve the loading or readiness diagnostics below. Restart after changing configuration or credentials.",
            }
          : {}),
      });
    } catch (cause) {
      checks.push({
        name: "execution",
        status: "attention",
        message: errorView(cause).message,
        nextStep:
          "Check intloom status and retry after the service is available.",
      });
    }
  }
  return { ...diagnosis, source, checks, ...(workflows ? { workflows } : {}) };
}

export function renderDoctor(result: ProjectDoctorResult) {
  return [
    renderDiagnosis(result),
    `Execution entry: ${result.source}`,
    ...result.checks.flatMap((check) => [
      `${check.name} · ${check.status}: ${check.message}`,
      ...(check.nextStep ? [check.nextStep] : []),
    ]),
    ...(result.workflows ? [renderWorkflows(result.workflows)] : []),
  ].join("\n");
}
