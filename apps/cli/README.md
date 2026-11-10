# IntLoom CLI

Install a Loom, run one of its commands and retrieve the result from your terminal. The CLI keeps run history in a local service. You can close the terminal and inspect a waiting run or a completed delivery later.

[Everyday CLI](../../docs/use/cli.md) · [CLI for Loom authors](../../docs/author/cli.md)

## Install and run

For a registry carrying 0.4.0, install with `npm install --global intloom@0.4.0`. The matching version of `@intloom/cli` provides the same command. For a source build, follow the [local candidate instructions](../../docs/maintainers/candidate.md).

The [file-report walkthrough](../../docs/use/first-loom.md) includes the archive used here. From its directory:

```sh
intloom install ./file-report-0.4.0.tgz
intloom run file-report
intloom run file-report --input '{"message":"First delivery"}'
```

The first invocation displays the package's commands. The second writes a report and returns a run ID and file reference. Use `--project .` on installation to keep the package in one project.

## Follow a run and collect its files

Replace the identifiers with those from your run:

```sh
intloom status <runId>
intloom interaction list --run <runId>
intloom interaction respond <requestId>
intloom artifact list --run <runId>
intloom artifact export <artifactId> --out ./report.txt
```

Respond when the run asks a question or requests approval. Use `intloom status <runId> --watch` to follow progress. Add `--confirm-delivery` when starting a file-producing run to review the candidate before delivery.

## Use the terminal or a script

Run `intloom` in an interactive terminal to browse your Looms and runs. Use `intloom status --plain` for machine-readable output and `intloom run --help` for command-specific options. The first run can start the local service. Use `intloom startup` to observe it and `intloom shutdown` to review pending work before stopping it.

[Command reference](../../docs/reference/cli.md) · [MCP clients](../../docs/reference/mcp.md) · [CLI release notes](../../releases/cli)

## Local service clients

A Node.js host can import `createServiceClient(dataDir, projectDir?)` and `startLocalService(dataDir)` from `@intloom/cli/local-service`. Use the same user directory as the CLI (normally `~/.intloom`). The client exposes typed service requests, including `serviceStatus`, Run operations and artifact export. The service status includes the npm root it can discover. `installGlobalLoom(source)` prepares npm Looms and their declared child Looms using the host's npm environment. Use the service's global prefix for package management.
