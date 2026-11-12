# IntLoom CLI

Install a Loom, run one of its commands and retrieve the result from your terminal. The CLI keeps run history in a local service. You can close the terminal and inspect a waiting run or a completed delivery later.

[Everyday CLI](../../docs/use/cli.md) · [CLI for Loom authors](../../docs/author/cli.md)

## Install and run

Install the CLI from npm with `npm install --global intloom`. For a source build, follow the [local candidate instructions](../../docs/maintainers/candidate.md).

Install the official [meeting-notes Loom](../../examples/meeting-notes/README.md) and inspect its commands.

```sh
intloom install @intloom/meeting-notes
intloom run @intloom/meeting-notes
```

[Configure a model with structured output](../../docs/reference/configuration.md), then pass meeting text to `summarize`. It returns a run ID and a reference to the Markdown minutes.

```sh
intloom run @intloom/meeting-notes summarize --prompt 'We agreed to pilot with 10% of accounts. The launch date is still open. Chen will share regression results by Thursday.'
```

## Follow a run and collect its files

Replace the identifiers with those from your run:

```sh
intloom status <runId>
intloom interaction list --run <runId>
intloom interaction respond <requestId>
intloom artifact list --run <runId>
intloom artifact export <artifactId> --out ./meeting-notes.md
```

Respond when the run asks a question or requests approval. Use `intloom status <runId> --watch` to follow progress. Add `--confirm-delivery` when starting a file-producing run to review the candidate before delivery.

When `intloom run` or `intloom status <runId> --watch` observes a successful Markdown delivery in a terminal, it displays the formatted document. Each preview shows up to 64 KiB. Use the artifact export command for the complete original file. Piped and `--plain` output retain their structured format.

## Use the terminal or a script

Run `intloom` in an interactive terminal to browse your Looms and runs. Use `intloom status --plain` for machine-readable output and `intloom run --help` for command-specific options. The first run can start the local service. Use `intloom startup` to observe it and `intloom shutdown` to review pending work before stopping it.

[Command reference](../../docs/reference/cli.md) · [MCP clients](../../docs/reference/mcp.md) · [CLI release notes](../../releases/cli)

## Local service clients

A Node.js host can import `createServiceClient(dataDir, projectDir?)` and `startLocalService(dataDir)` from `@intloom/cli/local-service`. Use the same user directory as the CLI (normally `~/.intloom`). The client exposes typed service requests, including `serviceStatus`, Run operations and artifact export. The service status includes the npm root it can discover. `installGlobalLoom(source)` prepares npm Looms and their declared child Looms using the host's npm environment. Use the service's global prefix for package management.
