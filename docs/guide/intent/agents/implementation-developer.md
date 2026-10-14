---
title: Implementation Developer
---

# Implementation Developer

`implementation-developer` is the Implementation Agent, using the `coding` role or external task executor.

## Inputs and responsibilities

It uses fixed confirmed requirements/design, the command plan, project snapshots and repair feedback. It changes actual project files and submits a declaration of the changes.

## Tools and output

Business Tools are `readImplementationContext` and `submitImplementation`. Engineering Tools list, read, write and remove project files and run argument-array commands. The final outcome is `ready`.

Code compares the proposal with actual changes, runs agreed checks, provides repair feedback, and rechecks the final snapshot before committing the Implementation Record. Agent-submitted declarations do not replace host evidence.

## Assess its work

Read the actual diff, file origins and check results. A failed check can return to implementation within the same Run. Cancellation or failure preserves files already changed; inspect them before new work. See [stage details](../stages.md) and [results](../results.md).
