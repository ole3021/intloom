# IntLoom guides

A Loom packages a job someone knows how to do. A presentation Loom might take a brief and source material and deliver editable slides. Install a Loom, give it your own input, and use the run ID to return to its questions or retrieve the delivered file.

| I want to… | Start here | Then try |
| --- | --- | --- |
| Try a Workflow that asks a question and delivers a weather greeting without a model | [Hello Loom](../examples/hello-loom/README.md) | [How its three steps work](../examples/hello-loom/hello.ts) |
| Use a Loom someone shared | [Install a Loom from npm](use/first-loom.md) | [Everyday CLI](use/cli.md) · [Manage installations](use/manage-looms.md) · [Answer questions and review files](use/questions-and-review.md) · [Troubleshoot](use/troubleshooting.md) |
| Produce minutes from my meeting | [Install and use meeting-notes](../examples/meeting-notes/README.md) | [Inspect a sample delivery](../examples/meeting-notes/samples/action.minutes.md) |
| Develop a Loom in TypeScript | [Build and share a first package](author/first-package.md) | [Choose the entry](author/choose-an-entry.md) · [Author CLI](author/cli.md) · [Package structure](author/package-structure.md) |
| Develop with a coding agent | [Give the agent this Markdown guide](ai/loom-authoring.md) | Supply an example input, the expected delivery and a way to check it. |
| Extend a package | [Agents and tools](author/agents-and-tools.md) · [Workflows and child Looms](author/workflows-and-child-looms.md) | [Delivery and revision](author/delivery-and-revision.md) · [Distribution](author/distribution.md) |

## Look up a contract

[CLI commands](reference/cli.md) · [loom.yaml](reference/loom-manifest.md) · [Host configuration](reference/configuration.md) · [SDK](reference/sdk.md) · [Compiler](reference/compiler.md) · [Kernel](reference/kernel.md) · [MCP](reference/mcp.md) · [Run events](reference/run-events.md)

For an existing project exporting `defineLoom`, use the [compiled-artifact guide](compatibility/compiled-artifact.md). Framework contributors can find [development and verification](maintainers/development.md) and [local candidate installation](maintainers/candidate.md).
