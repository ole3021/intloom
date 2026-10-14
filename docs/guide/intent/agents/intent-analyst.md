---
title: Intent Analyst
---

# Intent Analyst

`intent-analyst` is the Specification Agent, using the `reasoning` model role or the external MCP task executor.

## Inputs and responsibilities

It reads the original intent, current Specification draft, baseline and feedback. It edits changed requirement objects, reviews consistency and identifies unresolved questions. The three declared Skills are specification analysis, clarification and review.

## Tools and output

`readSpecification` reads context; `editSpecification` validates and saves changed objects; `submitSpecification` submits new questions or finishes analysis. The final Step result is `clarification_required` or `ready`. Code then controls questioning, checking and confirmation.

Editable schemas exclude system history; Tools maintain cumulative changes and reject stale draft revisions. Real answers, skip decisions, confirmation and formal persistence are owned by Code.

## Work effectively with this role

Provide concrete goals, affected applications, scenarios and acceptance conditions. Use feedback to correct missing or contradictory requirements before confirming. Read [Specification behavior](../stages.md) and [human interaction](../interaction.md).

Draft revision tokens are validated by Schema; stale submissions return the current revision without consuming a business proposal attempt.
