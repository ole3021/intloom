import { resolve } from "node:path";
import { type Command, InvalidArgumentError } from "commander";
import type { ProjectClient } from "../client/contracts.ts";
import {
  parseArtifactQuery,
  parseArtifactSelector,
} from "../application/artifacts.ts";
import { failure } from "../errors.ts";
import { renderArtifact, renderArtifacts } from "../ui/artifacts.ts";
import type { TerminalUi } from "../ui/terminal.ts";
import { exportArtifact } from "./export-artifact.ts";

type Settings = (command: Command) => {
  directory: string;
  options: Record<string, unknown>;
  ui: TerminalUi;
};

export function registerArtifactCommands(
  program: Command,
  settings: Settings,
  cwd: string,
  connected: <T>(
    directory: string,
    action: (client: ProjectClient) => Promise<T>,
  ) => Promise<T>,
) {
  program
    .command("artifacts")
    .description("List metadata for current committed Artifacts")
    .option("--flow <flowName>", "Filter by Workflow")
    .option("--stage <stageName>", "Filter by Stage")
    .option(
      "--limit <count>",
      "1–200 items per page; default 50",
      (value: string) => {
        if (!/^\d+$/u.test(value) || Number(value) < 1 || Number(value) > 200)
          throw new InvalidArgumentError("limit must be between 1 and 200");
        return Number(value);
      },
    )
    .option(
      "--cursor <cursor>",
      "Continue to the next page with the same filters",
    )
    .action(async (_options, command) => {
      const { directory, options, ui } = settings(command);
      const query = parseArtifactQuery({
        ...(options.flow === undefined ? {} : { flowName: options.flow }),
        ...(options.stage === undefined ? {} : { stageName: options.stage }),
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
      });
      await connected(directory, async (client) => {
        const page = await client.listArtifacts(query);
        ui.result(
          { artifacts: page },
          renderArtifacts(
            page,
            query,
            directory === resolve(cwd) ? undefined : directory,
          ),
        );
      });
    });
  program
    .command("artifact [artifactId]")
    .description(
      "View a committed Artifact or export the query snapshot as JSON",
    )
    .option(
      "--flow <flowName>",
      "Locate an artifact with --stage; cannot be combined with an ID",
    )
    .option("--stage <stageName>", "Locate an artifact with --flow")
    .option(
      "--output <filename>",
      "Save the complete Artifact JSON relative to the current directory",
    )
    .option("--overwrite", "Explicitly overwrite an existing export file")
    .action(async (artifactId: string | undefined, _options, command) => {
      const { directory, options, ui } = settings(command);
      const selector = parseArtifactSelector({
        ...(artifactId === undefined ? {} : { artifactId }),
        ...(options.flow === undefined ? {} : { flowName: options.flow }),
        ...(options.stage === undefined ? {} : { stageName: options.stage }),
      });
      if (options.overwrite && options.output === undefined)
        throw failure("INVALID_REQUEST", "--overwrite requires --output.");
      const artifact = await connected(directory, (client) =>
        client.getArtifact(selector),
      );
      if (typeof options.output === "string") {
        if (artifact === null)
          throw failure(
            "NOT_FOUND",
            "Committed Artifact not found; no file was exported.",
          );
        const outputFile = resolve(cwd, options.output);
        await exportArtifact(artifact, outputFile, options.overwrite === true);
        ui.result(
          { artifact, outputFile },
          `Exported ${artifact.id} · revision ${artifact.revision}\n${outputFile}`,
        );
      } else
        ui.result(
          { artifact },
          renderArtifact(
            artifact,
            directory === resolve(cwd) ? undefined : directory,
          ),
        );
    });
}
