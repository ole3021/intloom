---
title: Solution Designer
---

# Solution Designer

`solution-designer` is the Solution Agent, using the `reasoning` role or external task executor.

## Inputs and responsibilities

It reads fixed confirmed Specification, the current design baseline, project context and human feedback. It proposes architecture, concepts, scenarios, decisions, risks and an executable verification command plan.

## Tools and output

`readSolutionContext` reads the draft; `editSolution` saves changed objects; `submitSolution` finishes the design or submits new questions with its check plan. `listProject` and `readProject` inspect actual files. This role does not receive project write/remove Tools.

Final outcomes are `clarification_required` and `ready`. Code checks proposals, gathers answers, obtains design confirmation and saves the formal Solution.

## Review its design

Check traceability to requirements, executable check commands, technology assumptions, affected scope and risks. Require changes through feedback before confirmation if any of these do not match your intent. See [the complete walkthrough](../walkthrough.md).

Draft revision tokens are validated by Schema; stale submissions return the current revision without consuming a business proposal attempt.
