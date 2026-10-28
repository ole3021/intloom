import { loadConfig } from "@intloom/kernel/host";
import type { RunSource, LoomView } from "@intloom/kernel";
import { errorView, failure } from "../../errors.ts";
import { connectProjectClient } from "../../client/mcp-client.ts";
import { discoverProjectConnection } from "../../client/project-client.ts";
import { diagnoseProject, type ProjectDiagnosis } from "@intloom/kernel/host";
import { listInstalledLooms } from "../loom-packages.ts";

export interface ProjectDoctorResult extends ProjectDiagnosis {
  readonly source: RunSource;
  readonly checks: readonly {
    readonly name: "configuration" | "installation" | "execution";
    readonly status: "ok" | "attention" | "not_checked";
    readonly message: string;
    readonly nextStep?: string;
  }[];
  readonly looms?: readonly LoomView[];
}

/** Reads configuration/installations and queries an existing host; never imports Looms, installs packages, or calls a model. */
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
        status: "not_checked",
        message:
          service && !config.llms && !config.models
            ? "No service models are configured. Pure Code can run; Agent readiness depends on its declared model profiles or legacy purposes."
            : service
              ? "Model configuration is present; required roles and credentials are checked by the host before Run creation. Remote model behavior is not verified."
              : "This entry selects the client Agent executor. The running host reports Loom readiness; client task support requires separate acceptance.",
        nextStep:
          diagnosis.status !== "offline"
            ? "Resolve the service and lock diagnosis above before starting the project."
            : service && !config.llms && !config.models
              ? "Run intloom start and inspect Loom readiness; configure required models or legacy llms and their credentials."
              : `Run intloom start, then intloom doctor --execution ${source} to inspect loaded Looms.`,
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
    const installed = await listInstalledLooms(root);
    const ready = installed.installation === "ready";
    checks.push({
      name: "installation",
      status: ready ? "ok" : "attention",
      message: ready
        ? `${installed.looms.length} declared Loom packages match the installed tree. Loading is checked separately by the host.`
        : installed.installation === "empty"
          ? "No Loom packages are installed."
          : "The installed tree is missing, damaged, or differs from the declarations.",
      ...(!ready
        ? {
            nextStep: installed.looms.length
              ? "Stop and start the service to restore declared packages. Keep local source archives accessible."
              : "Stop any running service, then run intloom loom add <package-or-tgz>.",
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
  let looms: readonly LoomView[] | undefined;
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
        looms = await client.listLooms();
      } finally {
        await client.close();
      }
      const ready = looms.filter(
        (item) => item.isAvailable && item.readiness?.status === "available",
      ).length;
      checks.push({
        name: "execution",
        status: ready ? "ok" : "attention",
        message: `${ready} of ${looms.length} Looms are ready for ${source}. This does not call or verify a remote model.`,
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
  return { ...diagnosis, source, checks, ...(looms ? { looms } : {}) };
}
