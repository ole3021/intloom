---
title: The four Intent stages
---

# The four Intent stages

## Specification

[Intent Analyst](./agents/intent-analyst.md) proposes cumulative requirement changes and unanswered questions. Code checks proposals, asks the user, prepares confirmation and persists the accepted Artifact/Record. Feedback routes back to analysis.

## Solution

[Solution Designer](./agents/solution-designer.md) uses the fixed confirmed Specification, reads project files, and proposes design changes plus a command plan. Code validates references and checks, obtains clarification/confirmation, and saves the Solution Artifact/Record.

## Implementation

[Implementation Developer](./agents/implementation-developer.md) uses confirmed requirements and design to edit project files. Code checks declared versus actual changes and executes the agreed commands. Failed checks return repair feedback. Finalization rechecks the snapshot before saving an Implementation Record.

## Validation

[Validation Analyst](./agents/validation-analyst.md) reads fixed bases and delivery evidence, proposes target assessments and findings. Host Code owns repeated checks, report consistency and computed statistics, then saves a Validation Artifact.

## Shared rules

Agents propose business content; Code owns actual human responses, confirmation, command evidence and formal persistence. Stage State is separate from formal outputs.

The normal stage route is linear, but feedback/check loops occur inside stages. Specification waits have recovery continuations; Solution waits currently depend on the live call. See [interaction](./interaction.md) and [recovery](../usage/recovery.md).
