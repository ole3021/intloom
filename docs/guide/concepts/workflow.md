---
title: Workflow, Stage, Step, and Run
---

# Workflow, Stage, Step, and Run

| Concept | Meaning |
| --- | --- |
| Project | Configuration, installed Workflow declarations, source files and data |
| Workflow | Named reusable definition of stages and routing |
| Stage | A business phase with a Schema, initializer and Step topology |
| Step | One Code or Agent execution with declared outcome routes |
| Run | One execution of a Workflow for an original intent |

A Workflow package compiles into `blueprint`, `codes` and `agentSpecs`. The Service loads these resources, registers `flowName`, and creates a Run when execution is admitted.

## Routing

The Workflow declares its entry Stage; each Stage declares its entry Step. Code/Agent returns an outcome. A Step route either selects another Step or ends the Stage. The Stage outcome then selects another Stage or ends the Workflow.

Loops are explicit routes. Stage State persists within a visit; entering a Stage again initializes a new binding. A cleared State does not automatically initialize again inside a Step loop.

## Definition versus execution

Installing a package does not create a Run. Starting the Service loads definitions. `flow` creates execution; `answer` continues it. Run IDs and action IDs identify different objects.

`exclusive: true` prevents competing active Runs in the same host, including waits. Other definitions can permit concurrency. The four Intent stages are one concrete Workflow, not a framework-wide requirement.

See [routing development](../development/stages.md) and [lifecycle](./lifecycle.md).
