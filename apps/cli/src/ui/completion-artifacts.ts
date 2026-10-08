import type { RunView } from "@intloom/kernel";
import type { ProjectClient } from "../client/contracts.ts";
import { errorView } from "../errors.ts";
import { artifactListCommand, renderArtifacts } from "./artifacts.ts";
import type { TerminalUi } from "./terminal.ts";

/** Adds current artifact links without changing execution outcomes on query failure; JSON retains a single Run snapshot. */
export async function showCompletionArtifacts(
  client: Pick<ProjectClient, "listArtifacts">,
  run: RunView,
  ui: TerminalUi,
  projectRoot?: string,
) {
  if (run.status !== "completed" || ui.json) return;
  const query = { flowName: run.flowName };
  let message: string;
  try {
    message = renderArtifacts(
      await client.listArtifacts(query),
      query,
      projectRoot,
    );
  } catch (error) {
    const view = errorView(error);
    message = `The Run completed, but querying current committed artifacts failed: ${view.code}: ${view.message}`;
  }
  ui.result(
    undefined,
    `${message}\nView ${artifactListCommand(query, projectRoot)}`,
  );
}
