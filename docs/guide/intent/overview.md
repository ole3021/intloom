---
title: Intent Workflow
---

# Intent Workflow

`@intloom/workflow-intent` is IntLoom's software-development Workflow. It carries one intent through **Specification → Solution → Implementation → Validation** under the same Run ID.

## What each stage does

| Stage | Work | Formal result |
| --- | --- | --- |
| Specification | Clarify requirements and obtain confirmation | Specification Artifact and Record |
| Solution | Design against confirmed requirements and agree checks | Solution Artifact and Record |
| Implementation | Change files and pass host-executed checks | Implementation Record |
| Validation | Independently assess delivery and repeat checks | Validation Artifact |

Human confirmation gates requirements and design before implementation. Feedback revises the current draft; it continues the same Run.

## Start using it

Install the package using [Workflow setup](../start/workflow.md), then choose [CMD](../start/cmd.md), [TUI](../start/tui.md), or [MCP](../start/mcp.md). Read [the complete walkthrough](./walkthrough.md) before approving your first design.

Intent is exclusive within one host while active, including waits. Earlier commits and project changes remain after failure or cancellation. `completed` means the Validation report was saved; examine the report to assess delivery.

See [stage details](./stages.md), [human interaction](./interaction.md), and [result interpretation](./results.md). Internal Agent pages explain each role; external client setup lives in [MCP usage](../usage/mcp.md).
