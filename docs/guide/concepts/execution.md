---
title: Code, Agents, Tools, and Skills
---

# Code, Agents, Tools, and Skills

Code and Agent Steps share outcome routing, but serve different responsibilities.

| Resource | Role |
| --- | --- |
| Code | Deterministic business rules, questions, confirmation and formal commits |
| Agent | Reasoning under instructions and an output Schema |
| Tool | Typed callable capability assigned to an Agent Step |
| Skill | Declared instruction content and optional packaged assets |

## Capability boundaries

Code receives Stage State, writable Storage, human interaction, a cancellation signal and optional Project access. Agent Tools receive State, read-only Storage, a signal and optional Project access. Agent Tools cannot directly commit formal data or invoke human interaction.

Code normally reads business data from State and returns `{ outcome: "..." }`. Agent final output is parsed by its original Zod Schema; host Tool input and output are also parsed and checked for JSON compatibility.

## Execution environments

Service execution constructs models from project settings. External MCP execution hands the declared task to the connected client, with claimed ownership and serial Tool calls. The same host validates capabilities and results in both modes.

Capabilities belong to one current call. Await operations; do not retain access in module state or continue using it after return, cancellation or transition.

See [Code and Agents](../development/execution.md) and [Tools and Skills](../development/tools-skills.md).
